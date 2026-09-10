import { ConnectionError, checkPublicHost, decryptKey, encryptKey, execution, n8nGet, n8nRequest, normalizeInstance, page, workflow } from './n8n-core.ts';
import type { WorkflowDraft } from './n8n-types.ts';

export type Bindings = { DB: D1Database; N8N_ENCRYPTION_KEY: string };
type Saved = { instance_url: string; encrypted_key: string; connected_at: string };
const empty = { connected: false, workflows: { data: [], nextCursor: null }, executions: { data: [], nextCursor: null } };
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, oai-authenticated-user-id', 'X-Content-Type-Options': 'nosniff' };
const siteOrigin = 'https://operator-core-ai-team.tomsinas44.chatgpt.site';

export async function handleN8nRequest(request: Request, bindings: Bindings, fetcher: typeof fetch = fetch, allowLocal = false) {
  try {
    const owner = request.headers.get('oai-authenticated-user-id');
    if (!owner) throw new ConnectionError('Sign in to this dashboard to connect your n8n account.', 401);
    if (!bindings.DB) throw new ConnectionError('Connection storage is not available yet.', 503);
    const requestUrl = new URL(request.url);
    if (request.method !== 'GET') {
      const origin = request.headers.get('origin');
      if (!origin || (origin !== requestUrl.origin && origin !== siteOrigin)) throw new ConnectionError('This request must come from the dashboard.', 403);
    }
    const operation = requestUrl.searchParams.get('operation');
    if (request.method === 'DELETE' && !operation) {
      await bindings.DB.prepare('DELETE FROM n8n_connections WHERE user_id = ?').bind(owner).run();
      return Response.json(empty, { headers });
    }
    let saved: Saved | null;
    let key: string;
    let initialWorkflows: ReturnType<typeof page<ReturnType<typeof workflow>>> | undefined;
    if (request.method === 'POST' && !operation) {
      if (!request.headers.get('content-type')?.includes('application/json')) throw new ConnectionError('Send the connection form as JSON.');
      if (Number(request.headers.get('content-length') || 0) > 8192) throw new ConnectionError('Connection details are too long.', 413);
      const text = await request.text();
      if (text.length > 8192) throw new ConnectionError('Connection details are too long.', 413);
      let input: { instanceUrl?: unknown; apiKey?: unknown };
      try { input = JSON.parse(text); } catch { throw new ConnectionError('The connection form is invalid.'); }
      if (!input || typeof input.instanceUrl !== 'string' || typeof input.apiKey !== 'string') throw new ConnectionError('Enter both your instance URL and API key.');
      const instance = normalizeInstance(input.instanceUrl, allowLocal);
      key = input.apiKey.trim();
      if (key.length < 8 || key.length > 4096 || Array.from(key).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new ConnectionError('Enter a valid n8n API key.');
      if (instance !== 'http://localhost:5678') await checkPublicHost(instance, fetcher);
      initialWorkflows = page(await n8nGet(instance, key, 'workflows', { limit: '50' }, fetcher), workflow);
      const encrypted = await encryptKey(key, owner, bindings.N8N_ENCRYPTION_KEY);
      const now = new Date().toISOString();
      await bindings.DB.prepare('INSERT INTO n8n_connections (user_id, instance_url, encrypted_key, connected_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET instance_url = excluded.instance_url, encrypted_key = excluded.encrypted_key, connected_at = excluded.connected_at').bind(owner, instance, encrypted, now).run();
      saved = { instance_url: instance, encrypted_key: encrypted, connected_at: now };
    } else {
      saved = await bindings.DB.prepare('SELECT instance_url, encrypted_key, connected_at FROM n8n_connections WHERE user_id = ?').bind(owner).first<Saved>();
      if (!saved) return Response.json(empty, { headers });
      key = await decryptKey(saved.encrypted_key, owner, bindings.N8N_ENCRYPTION_KEY);
      const instance = normalizeInstance(saved.instance_url, allowLocal);
      if (instance !== 'http://localhost:5678') await checkPublicHost(instance, fetcher);
    }
    if (operation) {
      if (!['create', 'update', 'activate', 'deactivate', 'trigger'].includes(operation)) throw new ConnectionError('Unsupported workflow action.');
      const workflowId = requestUrl.searchParams.get('workflowId');
      if (operation !== 'create' && (!workflowId || !/^[a-zA-Z0-9_-]{1,128}$/.test(workflowId))) throw new ConnectionError('Invalid workflow ID.');
      if (operation === 'activate' || operation === 'deactivate') {
        if (request.method !== 'POST') throw new ConnectionError('Unsupported request method.', 405);
        const raw = await n8nRequest(saved.instance_url, key, `workflows/${workflowId}/${operation}`, { method: 'POST' }, fetcher);
        return Response.json(workflow(raw), { headers });
      }
      if (operation === 'trigger') {
        if (request.method !== 'POST') throw new ConnectionError('Unsupported request method.', 405);
        const latest = asRecord(await n8nGet(saved.instance_url, key, `workflows/${workflowId}`, {}, fetcher));
        if (latest.active !== true) throw new ConnectionError('Activate this workflow before sending a webhook event.');
        const webhook = asList(latest.nodes).map(asRecord).find(node => typeof node.type === 'string' && node.type.endsWith('.webhook') && node.disabled !== true);
        if (!webhook) throw new ConnectionError('This workflow does not have an enabled webhook trigger.');
        const parameters = asRecord(webhook.parameters); const method = String(parameters.httpMethod || 'GET').toUpperCase(); const path = String(parameters.path || '').replace(/^\/+/, '');
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !path || path.length > 500 || /[\u0000-\u001f\\?#]/.test(path)) throw new ConnectionError('The workflow webhook settings are not valid.');
        const text = await request.text(); if (text.length > 128_000) throw new ConnectionError('The test input is too large.', 413);
        let input: unknown; try { input = text ? JSON.parse(text) : {}; } catch { throw new ConnectionError('The test input must be valid JSON.'); }
        const target = new URL(`webhook/${path}`, `${saved.instance_url}/`);
        if (target.origin !== new URL(saved.instance_url).origin) throw new ConnectionError('The workflow webhook address is not valid.');
        const response = await fetcher(target, { method, headers: { Accept: 'application/json, text/plain', ...(method === 'GET' || method === 'DELETE' ? {} : { 'Content-Type': 'application/json' }) }, body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(input), redirect: 'manual', signal: AbortSignal.timeout(30000), cache: 'no-store' });
        if (!response.ok) throw new ConnectionError(`The webhook returned ${response.status}. Check the workflow and input in n8n.`, 502);
        const resultText = (await response.text()).slice(0, 200_000); let output: unknown = resultText;
        try { output = resultText ? JSON.parse(resultText) : null; } catch { /* Return plain text safely. */ }
        return Response.json({ status: 'success', output }, { headers });
      }
      if (request.method !== 'POST' && request.method !== 'PUT') throw new ConnectionError('Unsupported request method.', 405);
      const draft = await readDraft(request);
      let rawNodes: Record<string, unknown>[] = draft.nodes.map(node => ({ id: node.id, name: node.name, type: node.type, typeVersion: node.typeVersion, position: node.position, disabled: node.disabled || undefined, parameters: node.parameters || {} }));
      if (operation === 'update') {
        const latest = asRecord(await n8nGet(saved.instance_url, key, `workflows/${workflowId}`, {}, fetcher));
        const priorNodes = new Map(asList(latest.nodes).map(value => { const node = asRecord(value); return [String(node.id || node.name), node]; }));
        rawNodes = rawNodes.map(node => { const prior = priorNodes.get(String(node.id)) || priorNodes.get(String(node.name)); return prior?.credentials ? { ...node, credentials: prior.credentials } : node; });
      }
      const payload = { name: draft.name, nodes: rawNodes, connections: toConnections(draft), settings: draft.settings || {} };
      const raw = await n8nRequest(saved.instance_url, key, operation === 'create' ? 'workflows' : `workflows/${workflowId}`, { method: operation === 'create' ? 'POST' : 'PUT', body: payload }, fetcher);
      return Response.json(workflow(raw), { headers });
    }
    const workflowId = requestUrl.searchParams.get('workflowId');
    if (workflowId) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(workflowId)) throw new ConnectionError('Invalid workflow ID.');
      return Response.json(workflow(await n8nGet(saved.instance_url, key, `workflows/${workflowId}`, {}, fetcher)), { headers });
    }
    const resource = requestUrl.searchParams.get('resource');
    const cursor = requestUrl.searchParams.get('cursor');
    if (cursor && cursor.length > 4096) throw new ConnectionError('Invalid page cursor.');
    if (resource) {
      if (resource !== 'workflows' && resource !== 'executions') throw new ConnectionError('Unsupported resource.');
      const params: Record<string, string> = { limit: resource === 'workflows' ? '50' : '20' };
      if (resource === 'executions') params.includeData = 'false';
      if (cursor) params.cursor = cursor;
      const raw = await n8nGet(saved.instance_url, key, resource, params, fetcher);
      return Response.json(resource === 'workflows' ? page(raw, workflow) : page(raw, execution), { headers });
    }
    const [workflowResult, executionResult] = await Promise.allSettled([
      initialWorkflows ? Promise.resolve(initialWorkflows) : n8nGet(saved.instance_url, key, 'workflows', { limit: '50' }, fetcher).then(raw => page(raw, workflow)),
      n8nGet(saved.instance_url, key, 'executions', { limit: '20', includeData: 'false' }, fetcher).then(raw => page(raw, execution)),
    ]);
    if (workflowResult.status === 'rejected') throw workflowResult.reason;
    return Response.json({ connected: true, instanceUrl: saved.instance_url, connectedAt: saved.connected_at, syncedAt: new Date().toISOString(), workflows: workflowResult.value, executions: executionResult.status === 'fulfilled' ? executionResult.value : { data: [], nextCursor: null }, executionError: executionResult.status === 'rejected' ? safeError(executionResult.reason).message : undefined }, { headers });
  } catch (error) {
    const issue = safeError(error);
    return Response.json({ error: issue.message }, { status: issue.status, headers });
  }
}
type Data = Record<string, unknown>;
function asRecord(value: unknown): Data { return value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {}; }
function asList(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
async function readDraft(request: Request): Promise<WorkflowDraft> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new ConnectionError('Send workflow changes as JSON.');
  const text = await request.text();
  if (text.length > 1_000_000) throw new ConnectionError('This workflow is too large to edit here.', 413);
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new ConnectionError('The workflow draft is invalid.'); }
  const data = asRecord(input);
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 200 || !Array.isArray(data.nodes) || data.nodes.length > 500 || !Array.isArray(data.edges)) throw new ConnectionError('The workflow draft is incomplete.');
  const nodes = data.nodes.map((value, index) => {
    const node = asRecord(value); const pos = asList(node.position);
    if (typeof node.name !== 'string' || !node.name.trim() || typeof node.type !== 'string' || !/^[A-Za-z0-9_@./-]{3,180}$/.test(node.type)) throw new ConnectionError(`Step ${index + 1} is invalid.`);
    return { id: typeof node.id === 'string' && node.id ? node.id : crypto.randomUUID(), name: node.name.slice(0, 160), type: node.type, typeVersion: Number(node.typeVersion) || 1, disabled: node.disabled === true, position: [Math.round(Number(pos[0]) || 0), Math.round(Number(pos[1]) || 0)] as [number, number], parameters: asRecord(node.parameters) };
  });
  const names = new Set(nodes.map(node => node.name));
  if (names.size !== nodes.length) throw new ConnectionError('Every workflow step needs a unique name.');
  const edges = data.edges.map(value => { const edge = asRecord(value); return { from: typeof edge.from === 'string' ? edge.from : '', to: typeof edge.to === 'string' ? edge.to : '', type: typeof edge.type === 'string' ? edge.type : 'main', output: Number(edge.output) || 0, input: Number(edge.input) || 0 }; }).filter(edge => names.has(edge.from) && names.has(edge.to));
  return { name: data.name.trim(), nodes, edges, settings: asRecord(data.settings) };
}
function toConnections(draft: WorkflowDraft) {
  const result: Record<string, Record<string, Array<Array<{ node: string; type: string; index: number }>>>> = {};
  for (const edge of draft.edges) {
    const type = edge.type || 'main', output = edge.output || 0;
    result[edge.from] ||= {}; result[edge.from][type] ||= []; result[edge.from][type][output] ||= [];
    result[edge.from][type][output].push({ node: edge.to, type, index: edge.input || 0 });
  }
  return result;
}
function safeError(error: unknown) {
  return error instanceof ConnectionError ? error : new ConnectionError('The dashboard could not complete this request. Please try again.', 500);
}
