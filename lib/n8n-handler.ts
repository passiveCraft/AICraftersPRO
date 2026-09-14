import { ConnectionError, checkPublicHost, credential, decryptKey, encryptKey, execution, executionDetail, n8nGet, n8nRequest, normalizeInstance, page, workflow } from './n8n-core.ts';
import type { WorkflowDraft } from './n8n-types.ts';
import { AI_CRAFTERS_SYSTEMS } from './ai-crafters.ts';
import { buildSystemWorkflow } from './system-workflows.ts';

export type Bindings = { DB: D1Database; N8N_ENCRYPTION_KEY: string; N8N_DEV_INSTANCE_URL?: string; N8N_DEV_API_KEY?: string };
type Saved = { instance_url: string; encrypted_key: string; connected_at: string };
const empty = { connected: false, workflows: { data: [], nextCursor: null }, executions: { data: [], nextCursor: null }, credentials: [] };
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
    let key = '';
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
      if (!saved && allowLocal && bindings.N8N_DEV_INSTANCE_URL && bindings.N8N_DEV_API_KEY) {
        const instance = normalizeInstance(bindings.N8N_DEV_INSTANCE_URL, true);
        key = bindings.N8N_DEV_API_KEY.trim();
        if (key.length < 8 || key.length > 4096 || Array.from(key).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new ConnectionError('The local n8n API key is invalid.');
        initialWorkflows = page(await n8nGet(instance, key, 'workflows', { limit: '50' }, fetcher), workflow);
        const encrypted = await encryptKey(key, owner, bindings.N8N_ENCRYPTION_KEY);
        const now = new Date().toISOString();
        await bindings.DB.prepare('INSERT INTO n8n_connections (user_id, instance_url, encrypted_key, connected_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET instance_url = excluded.instance_url, encrypted_key = excluded.encrypted_key, connected_at = excluded.connected_at').bind(owner, instance, encrypted, now).run();
        saved = { instance_url: instance, encrypted_key: encrypted, connected_at: now };
      }
      if (!saved) return Response.json(empty, { headers });
      if (!key) key = await decryptKey(saved.encrypted_key, owner, bindings.N8N_ENCRYPTION_KEY);
      const instance = normalizeInstance(saved.instance_url, allowLocal);
      if (instance !== 'http://localhost:5678') await checkPublicHost(instance, fetcher);
    }
    if (operation) {
      if (!['create', 'update', 'activate', 'deactivate', 'trigger', 'approval', 'provision'].includes(operation)) throw new ConnectionError('Unsupported workflow action.');
      const workflowId = requestUrl.searchParams.get('workflowId');
      if (operation !== 'create' && operation !== 'provision' && (!workflowId || !/^[a-zA-Z0-9_-]{1,128}$/.test(workflowId))) throw new ConnectionError('Invalid workflow ID.');
      if (operation === 'provision') {
        if (request.method !== 'POST') throw new ConnectionError('Unsupported request method.', 405);
        const current = page(await n8nGet(saved.instance_url, key, 'workflows', { limit: '100' }, fetcher), workflow).data;
        const duplicate = AI_CRAFTERS_SYSTEMS.find(system => current.filter(item => item.name === system.name && !item.archived).length > 1);
        if (duplicate) throw new ConnectionError(`Resolve the duplicate workflows named ${duplicate.name} before provisioning.`, 409);
        const credentials = page(await n8nGet(saved.instance_url, key, 'credentials', { limit: '100' }, fetcher), credential).data;
        const gemini = credentials.find(item => item.type === 'googlePalmApi');
        if (!gemini) throw new ConnectionError('Add a Google Gemini credential in n8n before provisioning the ecommerce Systems.', 409);
        const existing = AI_CRAFTERS_SYSTEMS.filter(system => current.some(item => item.name === system.name && !item.archived)).map(system => system.name);
        const created = [];
        for (const system of AI_CRAFTERS_SYSTEMS.filter(item => !existing.includes(item.name))) {
          const raw = asRecord(await n8nRequest(saved.instance_url, key, 'workflows', { method: 'POST', body: buildSystemWorkflow(system, gemini) }, fetcher));
          const createdWorkflow = workflow(raw);
          const activated = workflow(await n8nRequest(saved.instance_url, key, `workflows/${createdWorkflow.id}/activate`, { method: 'POST' }, fetcher));
          created.push({ id: activated.id, name: activated.name, active: activated.active, agents: activated.nodes.length });
        }
        return Response.json({ created, existing, credential: { name: gemini.name, type: gemini.type } }, { headers });
      }
      if (operation === 'activate' || operation === 'deactivate') {
        if (request.method !== 'POST') throw new ConnectionError('Unsupported request method.', 405);
        const raw = await n8nRequest(saved.instance_url, key, `workflows/${workflowId}/${operation}`, { method: 'POST' }, fetcher);
        return Response.json(workflow(raw), { headers });
      }
      if (operation === 'approval') {
        if (request.method !== 'POST') throw new ConnectionError('Unsupported request method.', 405);
        const text = await request.text();
        if (text.length > 4096) throw new ConnectionError('The approval request is too large.', 413);
        let input: unknown;
        try { input = JSON.parse(text); } catch { throw new ConnectionError('The approval request is invalid.'); }
        const approval = asRecord(input);
        const action = approval.action;
        const executionId = approval.executionId;
        if ((action !== 'approve' && action !== 'reject') || typeof executionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(executionId)) throw new ConnectionError('Choose approve or reject for a valid execution.');
        const latest = asRecord(await n8nGet(saved.instance_url, key, `workflows/${workflowId}`, {}, fetcher));
        const systemName = typeof latest.name === 'string' ? latest.name : '';
        if (!AI_CRAFTERS_SYSTEMS.some(system => system.name === systemName)) throw new ConnectionError('This workflow is not mapped to an AI Crafters Pro System.');
        const webhook = asList(latest.nodes).map(asRecord).find(node => node.name === 'AI Crafters Pro Approval' && typeof node.type === 'string' && node.type.endsWith('.webhook') && node.disabled !== true);
        if (!webhook) throw new ConnectionError('This System does not have an enabled AI Crafters Pro Approval webhook.', 409);
        const parameters = asRecord(webhook.parameters);
        const method = typeof parameters.httpMethod === 'string' ? parameters.httpMethod.toUpperCase() : 'GET';
        const path = typeof parameters.path === 'string' ? parameters.path.replace(/^\/+/, '') : '';
        if (method !== 'POST' || !path || path.length > 500 || /[\\?#]/.test(path) || path.split('/').some(part => part === '.' || part === '..') || Array.from(path).some(char => char.charCodeAt(0) < 32)) throw new ConnectionError('The approval webhook must be a valid POST webhook.', 409);
        if (latest.active !== true) await n8nRequest(saved.instance_url, key, `workflows/${workflowId}/activate`, { method: 'POST' }, fetcher);
        const target = new URL(`webhook/${path}`, `${saved.instance_url}/`);
        if (target.origin !== new URL(saved.instance_url).origin) throw new ConnectionError('The approval webhook address is not valid.');
        let response: Response;
        try {
          response = await fetcher(target, {
            method: 'POST',
            headers: { Accept: 'application/json, text/plain', 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, executionId, systemName, source: 'ai-crafters-pro-dashboard', requestedBy: owner }),
            redirect: 'manual', signal: AbortSignal.timeout(60000), cache: 'no-store',
          });
        } catch { throw new ConnectionError('The approval webhook could not be reached.', 502); }
        if (!response.ok) throw new ConnectionError(`The approval webhook returned ${response.status}.`, 502);
        const resultText = (await response.text()).slice(0, 200_000);
        let output: unknown = resultText;
        try { output = resultText ? JSON.parse(resultText) : null; } catch { /* Plain text is a valid operator response. */ }
        return Response.json({ status: 'accepted', action, output }, { headers });
      }
      if (operation === 'trigger') {
        if (request.method !== 'POST') throw new ConnectionError('Unsupported request method.', 405);
        let latest = asRecord(await n8nGet(saved.instance_url, key, `workflows/${workflowId}`, {}, fetcher));
        let webhook = asList(latest.nodes).map(asRecord).find(node => node.name !== 'AI Crafters Pro Approval' && typeof node.type === 'string' && node.type.endsWith('.webhook') && node.disabled !== true);
        let runnerInstalled = false;
        if (!webhook) {
          const nodes = asList(latest.nodes).map(asRecord);
          const manual = nodes.find(node => typeof node.type === 'string' && node.type.endsWith('.manualTrigger') && node.disabled !== true);
          if (!manual || typeof manual.name !== 'string') throw new ConnectionError('This workflow has no manual or webhook entry point that the dashboard can execute.');
          const connections = asRecord(latest.connections);
          const outgoing = connections[manual.name];
          if (!outgoing) throw new ConnectionError('The Manual Trigger is not connected to a step, so there is nothing to execute.');
          const names = new Set(nodes.map(node => typeof node.name === 'string' ? node.name : ''));
          let runnerName = 'Operator Core Run Trigger';
          for (let suffix = 2; names.has(runnerName); suffix++) runnerName = `Operator Core Run Trigger ${suffix}`;
          const manualPosition = asList(manual.position);
          const runnerPath = `operator-core-${crypto.randomUUID()}-${crypto.randomUUID()}`;
          webhook = { id: crypto.randomUUID(), name: runnerName, type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [Number(manualPosition[0]) || 0, (Number(manualPosition[1]) || 0) + 180], parameters: { httpMethod: 'POST', path: runnerPath, responseMode: 'onReceived', options: {} } };
          const payload = { name: latest.name, nodes: [...nodes, webhook], connections: { ...connections, [runnerName]: outgoing }, settings: asRecord(latest.settings) };
          latest = asRecord(await n8nRequest(saved.instance_url, key, `workflows/${workflowId}`, { method: 'PUT', body: payload }, fetcher));
          runnerInstalled = true;
        }
        const parameters = asRecord(webhook.parameters); const method = (typeof parameters.httpMethod === 'string' ? parameters.httpMethod : 'GET').toUpperCase(); const path = (typeof parameters.path === 'string' ? parameters.path : '').replace(/^\/+/, '');
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !path || path.length > 500 || /[\\?#]/.test(path) || path.split('/').some(part => part === '.' || part === '..') || Array.from(path).some(char => char.charCodeAt(0) < 32)) throw new ConnectionError('The workflow webhook settings are not valid.');
        const text = await request.text(); if (text.length > 128_000) throw new ConnectionError('The test input is too large.', 413);
        let input: unknown; try { input = text ? JSON.parse(text) : {}; } catch { throw new ConnectionError('The test input must be valid JSON.'); }
        let activated = false;
        if (latest.active !== true) {
          await n8nRequest(saved.instance_url, key, `workflows/${workflowId}/activate`, { method: 'POST' }, fetcher);
          activated = true;
        }
        const target = new URL(`webhook/${path}`, `${saved.instance_url}/`);
        if (target.origin !== new URL(saved.instance_url).origin) throw new ConnectionError('The workflow webhook address is not valid.');
        if ((method === 'GET' || method === 'DELETE') && input && typeof input === 'object' && !Array.isArray(input)) {
          for (const [name, value] of Object.entries(input)) if (['string', 'number', 'boolean'].includes(typeof value)) target.searchParams.set(name, String(value));
        }
        const requestInit: RequestInit = { method, headers: { Accept: 'application/json, text/plain', ...(method === 'GET' || method === 'DELETE' ? {} : { 'Content-Type': 'application/json' }) }, body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(input), redirect: 'manual', signal: AbortSignal.timeout(60000), cache: 'no-store' };
        let response = await fetcher(target, requestInit);
        // n8n can need a brief moment to register a newly published production webhook.
        for (let attempt = 0; activated && response.status === 404 && attempt < 3; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
          response = await fetcher(target, requestInit);
        }
        if (!response.ok) {
          let diagnosis = '';
          try { const recent = page(await n8nGet(saved.instance_url, key, 'executions', { limit: '1', workflowId: workflowId!, status: 'error', includeData: 'false' }, fetcher), execution); const latest = recent.data[0]; if (latest) { const detail = executionDetail(await n8nGet(saved.instance_url, key, `executions/${latest.id}`, { includeData: 'true' }, fetcher)); diagnosis = detail.error ? ` ${detail.lastNode ? `${detail.lastNode}: ` : ''}${detail.error}` : ''; } } catch { /* Keep the webhook status when execution details are unavailable. */ }
          throw new ConnectionError(`The workflow failed.${diagnosis || ` Webhook returned ${response.status}.`}`, 502);
        }
        const resultText = (await response.text()).slice(0, 200_000); let output: unknown = resultText;
        try { output = resultText ? JSON.parse(resultText) : null; } catch { /* Return plain text safely. */ }
        return Response.json({ status: 'success', output, ...(runnerInstalled ? { runnerInstalled: true } : {}) }, { headers });
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
    const resource = requestUrl.searchParams.get('resource');
    if (workflowId && !resource) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(workflowId)) throw new ConnectionError('Invalid workflow ID.');
      return Response.json(workflow(await n8nGet(saved.instance_url, key, `workflows/${workflowId}`, {}, fetcher)), { headers });
    }
    const cursor = requestUrl.searchParams.get('cursor');
    if (cursor && cursor.length > 4096) throw new ConnectionError('Invalid page cursor.');
    if (resource) {
      if (!['workflows', 'executions', 'execution', 'credentials'].includes(resource)) throw new ConnectionError('Unsupported resource.');
      if (resource === 'execution') {
        const executionId = requestUrl.searchParams.get('executionId');
        if (!executionId || !/^[a-zA-Z0-9_-]{1,128}$/.test(executionId)) throw new ConnectionError('Invalid execution ID.');
        return Response.json(executionDetail(await n8nGet(saved.instance_url, key, `executions/${executionId}`, { includeData: 'true' }, fetcher)), { headers });
      }
      if (resource === 'credentials') return Response.json(page(await n8nGet(saved.instance_url, key, 'credentials', { limit: '100' }, fetcher), credential), { headers });
      const params: Record<string, string> = { limit: resource === 'workflows' ? '50' : '20' };
      if (resource === 'executions') params.includeData = 'false';
      const resourceWorkflowId = requestUrl.searchParams.get('workflowId');
      if (resource === 'executions' && resourceWorkflowId) {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(resourceWorkflowId)) throw new ConnectionError('Invalid workflow ID.');
        params.workflowId = resourceWorkflowId;
      }
      if (cursor) params.cursor = cursor;
      const raw = await n8nGet(saved.instance_url, key, resource, params, fetcher);
      return Response.json(resource === 'workflows' ? page(raw, workflow) : page(raw, execution), { headers });
    }
    const [workflowResult, executionResult, credentialResult] = await Promise.allSettled([
      initialWorkflows ? Promise.resolve(initialWorkflows) : n8nGet(saved.instance_url, key, 'workflows', { limit: '50' }, fetcher).then(raw => page(raw, workflow)),
      n8nGet(saved.instance_url, key, 'executions', { limit: '20', includeData: 'false' }, fetcher).then(raw => page(raw, execution)),
      n8nGet(saved.instance_url, key, 'credentials', { limit: '100' }, fetcher).then(raw => page(raw, credential)),
    ]);
    if (workflowResult.status === 'rejected') throw workflowResult.reason;
    return Response.json({ connected: true, instanceUrl: saved.instance_url, connectedAt: saved.connected_at, syncedAt: new Date().toISOString(), workflows: workflowResult.value, executions: executionResult.status === 'fulfilled' ? executionResult.value : { data: [], nextCursor: null }, credentials: credentialResult.status === 'fulfilled' ? credentialResult.value.data : [], executionError: executionResult.status === 'rejected' ? safeError(executionResult.reason).message : undefined, credentialError: credentialResult.status === 'rejected' ? safeError(credentialResult.reason).message : undefined }, { headers });
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
