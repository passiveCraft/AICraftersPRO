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
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); seen.push(url.toString());
    if (url.hostname === 'cloudflare-dns.com') return Response.json({ Answer: [{ type: 1, data: '1.1.1.1' }] });
    const key = new Headers(init?.headers).get('X-N8N-API-KEY');
    if (key === 'invalid-test-key') return Response.json({ private: 'do-not-return' }, { status: 401 });
    if (url.pathname.endsWith('/executions')) return key === 'workflow-only-key' ? Response.json({}, { status: 403 }) : Response.json({ data: [{ id: 'e1', workflowId: 'w1', status: 'success' }], nextCursor: 'more-executions' });
    if (url.pathname.endsWith('/workflows/w1')) return Response.json({ id: 'w1', name: 'Connected workflow', active: true, nodes: [{ id: 'hook', name: 'Receive', type: 'n8n-nodes-base.webhook', parameters: { httpMethod: 'POST', path: 'demo-hook' } }], credentials: 'private' });
    if (url.pathname.endsWith('/webhook/demo-hook')) return Response.json({ accepted: true });
    return Response.json({ data: [{ id: url.searchParams.has('cursor') ? 'w2' : 'w1', name: 'Connected workflow', active: true, nodes: [] }], nextCursor: url.searchParams.has('cursor') ? null : 'opaque+/=' });
  };
  const request = (owner: string | null, method = 'GET', body?: unknown, query = '', origin = 'https://dashboard.test') => new Request(`https://dashboard.test/api/n8n${query}`, { method, headers: { ...(owner ? { 'oai-authenticated-user-id': owner } : {}), Origin: origin, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const connect = (owner: string, apiKey = 'test-api-key') => handleN8nRequest(request(owner, 'POST', { instanceUrl: 'https://team.app.n8n.cloud', apiKey }), bindings, fetcher);
  return { rows, bindings, fetcher, request, seen, connect };
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
  const unsupported = await handleN8nRequest(f.request('a', 'GET', undefined, '?resource=credentials'), f.bindings, f.fetcher);
  assert.equal(unsupported.status, 400);
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
test('unauthenticated and cross-site mutations fail before any upstream request', async () => {
  const f = fixture();
  assert.equal((await handleN8nRequest(f.request(null), f.bindings, f.fetcher)).status, 401);
  assert.equal((await handleN8nRequest(f.request('a', 'DELETE', undefined, '', 'https://elsewhere.test'), f.bindings, f.fetcher)).status, 403);
  assert.equal(f.seen.length, 0);
});
