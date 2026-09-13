import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleN8nRequest, type Bindings } from '../lib/n8n-handler.ts';

function fixture() {
  const rows = new Map<string, { instance_url: string; encrypted_key: string; connected_at: string }>();
  const DB = { prepare(sql: string) { return { bind(...args: string[]) { return {
    async first() { return rows.get(args[0]) || null; },
    async run() {
      if (sql.startsWith('INSERT')) rows.set(args[0], { instance_url: args[1], encrypted_key: args[2], connected_at: args[3] });
      else if (sql.startsWith('DELETE')) rows.delete(args[0]);
      else throw new Error('Unexpected write');
      return { success: true };
    },
  }; } }; } } as unknown as D1Database;
  const bindings: Bindings = { DB, N8N_ENCRYPTION_KEY: 'b'.repeat(64) };
  const seen: string[] = [];
  const seenRequests: string[] = [];
  let manualWorkflow: Record<string, unknown> = { id: 'w3', name: 'Manual workflow', active: false, nodes: [{ id: 'manual', name: 'When clicking Execute workflow', type: 'n8n-nodes-base.manualTrigger', position: [0, 0], parameters: {} }, { id: 'work', name: 'Do work', type: 'n8n-nodes-base.set', position: [200, 0], parameters: {} }], connections: { 'When clicking Execute workflow': { main: [[{ node: 'Do work', type: 'main', index: 0 }]] } }, settings: {} };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); seen.push(url.toString()); seenRequests.push(`${init?.method || 'GET'} ${url.pathname}`);
    if (url.hostname === 'cloudflare-dns.com') return Response.json({ Answer: [{ type: 1, data: '1.1.1.1' }] });
    const key = new Headers(init?.headers).get('X-N8N-API-KEY');
    if (key === 'invalid-test-key') return Response.json({ private: 'do-not-return' }, { status: 401 });
    if (url.pathname.endsWith('/credentials')) return Response.json({ data: [{ id: 'cred-1', name: 'Gemini account', type: 'googlePalmApi', data: { apiKey: 'private' } }], nextCursor: null });
    if (url.pathname.endsWith('/executions')) return key === 'workflow-only-key' ? Response.json({}, { status: 403 }) : Response.json({ data: [{ id: 'e1', workflowId: 'w1', status: 'success' }], nextCursor: 'more-executions' });
    if (url.pathname.endsWith('/workflows/w2/activate')) return Response.json({ id: 'w2', name: 'Inactive webhook', active: true, nodes: [{ id: 'hook-2', name: 'Receive', type: 'n8n-nodes-base.webhook', parameters: { httpMethod: 'POST', path: 'inactive-hook' } }] });
    if (url.pathname.endsWith('/workflows/w2')) return Response.json({ id: 'w2', name: 'Inactive webhook', active: false, nodes: [{ id: 'hook-2', name: 'Receive', type: 'n8n-nodes-base.webhook', parameters: { httpMethod: 'POST', path: 'inactive-hook' } }] });
    if (url.pathname.endsWith('/workflows/w3/activate')) { manualWorkflow = { ...manualWorkflow, active: true }; return Response.json(manualWorkflow); }
    if (url.pathname.endsWith('/workflows/w3') && init?.method === 'PUT') { manualWorkflow = { ...JSON.parse(String(init.body)), id: 'w3', active: false }; return Response.json(manualWorkflow); }
    if (url.pathname.endsWith('/workflows/w3')) return Response.json(manualWorkflow);
    if (url.pathname.endsWith('/workflows/w1')) return Response.json({ id: 'w1', name: 'Connected workflow', active: true, nodes: [{ id: 'hook', name: 'Receive', type: 'n8n-nodes-base.webhook', parameters: { httpMethod: 'POST', path: 'demo-hook' } }], credentials: 'private' });
    if (url.pathname.endsWith('/webhook/demo-hook') || url.pathname.endsWith('/webhook/inactive-hook') || url.pathname.includes('/webhook/operator-core-')) return Response.json({ accepted: true });
    return Response.json({ data: [{ id: url.searchParams.has('cursor') ? 'w2' : 'w1', name: 'Connected workflow', active: true, nodes: [] }], nextCursor: url.searchParams.has('cursor') ? null : 'opaque+/=' });
  };
  const request = (owner: string | null, method = 'GET', body?: unknown, query = '', origin = 'https://dashboard.test') => new Request(`https://dashboard.test/api/n8n${query}`, { method, headers: { ...(owner ? { 'oai-authenticated-user-id': owner } : {}), Origin: origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const connect = (owner: string, apiKey = 'test-api-key') => handleN8nRequest(request(owner, 'POST', { instanceUrl: 'https://team.app.n8n.cloud', apiKey }), bindings, fetcher);
  return { rows, bindings, fetcher, request, seen, seenRequests, connect };
}
test('connect persists encrypted data, reload reads n8n, another member sees an empty workspace', async () => {
  const f = fixture(); const connected = await f.connect('member-a');
  assert.equal(connected.status, 200);
  const text = await connected.text(); assert.ok(!text.includes('test-api-key')); assert.ok(!text.includes('encrypted_key'));
  assert.equal(JSON.parse(text).workflows.data[0].id, 'w1');
  assert.ok(!f.rows.get('member-a')!.encrypted_key.includes('test-api-key'));
  const reloaded = await handleN8nRequest(f.request('member-a'), f.bindings, f.fetcher);
  assert.equal((await reloaded.json() as { connected: boolean }).connected, true);
  const other = await handleN8nRequest(f.request('member-b'), f.bindings, f.fetcher);
  assert.equal((await other.json() as { connected: boolean }).connected, false);
});
test('failed validation never saves or replaces a connection', async () => {
  const f = fixture(); const response = await f.connect('a', 'invalid-test-key');
  assert.equal(response.status, 401); assert.equal(f.rows.size, 0); assert.ok(!(await response.text()).includes('do-not-return'));
  await f.connect('a'); const saved = f.rows.get('a'); await f.connect('a', 'invalid-test-key'); assert.deepEqual(f.rows.get('a'), saved);
});
test('workflow-only scopes preserve a successful connection and report execution unavailability', async () => {
  const f = fixture(); const response = await f.connect('a', 'workflow-only-key');
  const data = await response.json() as { connected: boolean; executionError: string; executions: { data: unknown[] } };
  assert.equal(response.status, 200); assert.equal(data.connected, true); assert.match(data.executionError, /permission/); assert.equal(data.executions.data.length, 0);
});
test('pagination and workflow inspection use the saved connection and exclude credentials', async () => {
  const f = fixture(); await f.connect('a');
  const result = await handleN8nRequest(f.request('a', 'GET', undefined, '?resource=workflows&cursor=opaque%2B%2F%3D'), f.bindings, f.fetcher);
  assert.equal((await result.json() as { data: { id: string }[] }).data[0].id, 'w2');
  const detail = await handleN8nRequest(f.request('a', 'GET', undefined, '?workflowId=w1'), f.bindings, f.fetcher);
  assert.ok(!(await detail.text()).includes('credentials'));
  const credentials = await handleN8nRequest(f.request('a', 'GET', undefined, '?resource=credentials'), f.bindings, f.fetcher);
  const credentialText = await credentials.text(); assert.equal(credentials.status, 200); assert.ok(!credentialText.includes('apiKey')); assert.ok(credentialText.includes('googlePalmApi'));
});
test('workflow-filtered execution requests return an execution page instead of workflow details', async () => {
  const f = fixture(); await f.connect('a');
  const response = await handleN8nRequest(f.request('a', 'GET', undefined, '?resource=executions&workflowId=w1'), f.bindings, f.fetcher);
  const body = await response.json() as { data?: Array<{ workflowId: string }> };
  assert.equal(response.status, 200); assert.equal(body.data?.[0]?.workflowId, 'w1');
  assert.ok(f.seen.some(url => url.includes('/api/v1/executions?') && url.includes('workflowId=w1')));
});
test('disconnect deletes only the current member’s saved connection', async () => {
  const f = fixture(); await f.connect('a'); await f.connect('b');
  const response = await handleN8nRequest(f.request('a', 'DELETE'), f.bindings, f.fetcher);
  assert.equal(response.status, 200); assert.equal(f.rows.has('a'), false); assert.equal(f.rows.has('b'), true);
});
test('active webhook workflows accept bounded test input without exposing the API key', async () => {
  const f = fixture(); await f.connect('a');
  const response = await handleN8nRequest(f.request('a', 'POST', { orderId: 'DEMO-1' }, '?operation=trigger&workflowId=w1'), f.bindings, f.fetcher);
  assert.equal(response.status, 200);
  const body = await response.text(); assert.deepEqual(JSON.parse(body), { status: 'success', output: { accepted: true } });
  assert.ok(f.seen.some(url => url.endsWith('/webhook/demo-hook')));
  assert.ok(!body.includes('test-api-key'));
});
test('executing an inactive webhook publishes it before invoking its production URL', async () => {
  const f = fixture(); await f.connect('a');
  const response = await handleN8nRequest(f.request('a', 'POST', { orderId: 'DEMO-2' }, '?operation=trigger&workflowId=w2'), f.bindings, f.fetcher);
  assert.equal(response.status, 200);
  const activation = f.seen.findIndex(url => url.endsWith('/api/v1/workflows/w2/activate'));
  const invocation = f.seen.findIndex(url => url.endsWith('/webhook/inactive-hook'));
  assert.ok(activation >= 0); assert.ok(invocation > activation);
});
test('manual workflows get an idempotent dashboard runner and execute without editor-session access', async () => {
  const f = fixture(); await f.connect('a');
  const first = await handleN8nRequest(f.request('a', 'POST', { source: 'dashboard' }, '?operation=trigger&workflowId=w3'), f.bindings, f.fetcher);
  assert.equal(first.status, 200);
  assert.equal((await first.json() as { runnerInstalled: boolean }).runnerInstalled, true);
  assert.ok(f.seenRequests.includes('PUT /api/v1/workflows/w3'));
  assert.ok(f.seenRequests.includes('POST /api/v1/workflows/w3/activate'));
  assert.ok(f.seen.some(url => url.includes('/webhook/operator-core-')));

  const putCount = f.seenRequests.filter(item => item === 'PUT /api/v1/workflows/w3').length;
  const second = await handleN8nRequest(f.request('a', 'POST', { source: 'dashboard' }, '?operation=trigger&workflowId=w3'), f.bindings, f.fetcher);
  assert.equal(second.status, 200);
  assert.equal(f.seenRequests.filter(item => item === 'PUT /api/v1/workflows/w3').length, putCount);
});
test('unauthenticated and cross-site mutations fail before any upstream request', async () => {
  const f = fixture();
  assert.equal((await handleN8nRequest(f.request(null), f.bindings, f.fetcher)).status, 401);
  assert.equal((await handleN8nRequest(f.request('a', 'DELETE', undefined, '', 'https://elsewhere.test'), f.bindings, f.fetcher)).status, 403);
  assert.equal(f.seen.length, 0);
});
