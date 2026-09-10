import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicHost, decryptKey, encryptKey, execution, isPublicAddress, n8nGet, n8nRequest, normalizeInstance, page, workflow } from '../lib/n8n-core.ts';

test('normalizes cloud, API-root and reverse-proxy instance URLs', () => {
  assert.equal(normalizeInstance(' https://demo.app.n8n.cloud/api/v1/ '), 'https://demo.app.n8n.cloud');
  assert.equal(normalizeInstance('https://automation.mycompany.com/n8n/'), 'https://automation.mycompany.com/n8n');
});
test('rejects unsafe destinations and editor links before sending a key', () => {
  for (const url of ['http://demo.app.n8n.cloud', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://user:password@demo.app.n8n.cloud', 'https://demo.app.n8n.cloud:5678', 'https://a.internal', 'https://demo.app.n8n.cloud/workflow/123', 'https://demo.app.n8n.cloud?key=secret']) assert.throws(() => normalizeInstance(url));
});
test('blocks private and special address ranges', () => {
  for (const ip of ['10.2.1.5', '172.16.0.1', '192.168.1.1', '127.0.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1']) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress('1.1.1.1'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});
test('local n8n is allowed only by an explicit development option on its exact port', () => {
  assert.equal(normalizeInstance('http://localhost:5678/', true), 'http://localhost:5678');
  assert.equal(normalizeInstance('http://127.0.0.1:5678/api/v1', true), 'http://localhost:5678');
  assert.throws(() => normalizeInstance('http://localhost:5678/'));
  assert.throws(() => normalizeInstance('http://localhost:8080/', true));
  assert.throws(() => normalizeInstance('http://192.168.1.1:5678/', true));
});
test('DNS must resolve entirely to public addresses', async () => {
  const resolvePrivate = async () => Response.json({ Answer: [{ type: 1, data: '10.1.2.3' }] });
  await assert.rejects(checkPublicHost('https://automation.mycompany.com', resolvePrivate as typeof fetch), /public n8n server/);
  const resolvePublic = async () => Response.json({ Answer: [{ type: 1, data: '1.1.1.1' }] });
  await checkPublicHost('https://automation.mycompany.com', resolvePublic as typeof fetch);
});
test('encrypted API keys are randomized and bound to their owner', async () => {
  const secret = 'a'.repeat(64), apiKey = 'only-in-test-api-key';
  const one = await encryptKey(apiKey, 'member-one', secret);
  const two = await encryptKey(apiKey, 'member-one', secret);
  assert.notEqual(one, two);
  assert.ok(!one.includes(apiKey));
  assert.equal(await decryptKey(one, 'member-one', secret), apiKey);
  await assert.rejects(decryptKey(one, 'member-two', secret));
  await assert.rejects(decryptKey(one.slice(0, -4) + 'AAAA', 'member-one', secret));
});
test('n8n requests use the public API, header authentication and opaque pagination', async () => {
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/n8n/api/v1/workflows');
    assert.equal(url.searchParams.get('cursor'), 'opaque+/=');
    assert.equal(new Headers(init?.headers).get('X-N8N-API-KEY'), 'fixture-key');
    assert.equal(init?.method, 'GET'); assert.equal(init?.redirect, 'manual');
    return Response.json({ data: [], nextCursor: 'next-token' });
  };
  const result = page(await n8nGet('https://automation.mycompany.com/n8n', 'fixture-key', 'workflows', { cursor: 'opaque+/=' }, fakeFetch), workflow);
  assert.deepEqual(result, { data: [], nextCursor: 'next-token' });
});
test('workflow mutations use the n8n public API without exposing the key in the URL', async () => {
  let capturedUrl = '', captured: RequestInit | undefined;
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => { capturedUrl = String(input); captured = init; return Response.json({ id: 'w-2', name: 'Saved', nodes: [], connections: {} }); }) as typeof fetch;
  await n8nRequest('https://demo.app.n8n.cloud', 'private-key', 'workflows/w-2', { method: 'PUT', body: { name: 'Saved', nodes: [], connections: {}, settings: {} } }, fetcher);
  assert.equal(captured?.method, 'PUT'); assert.equal(new Headers(captured?.headers).get('X-N8N-API-KEY'), 'private-key');
  assert.ok(!capturedUrl.includes('private-key')); assert.equal(JSON.parse(String(captured?.body)).name, 'Saved');
});
test('a redirect is not followed with credentials', async () => {
  await assert.rejects(n8nGet('https://demo.app.n8n.cloud', 'fixture-key', 'workflows', {}, (async () => new Response(null, { status: 302, headers: { Location: 'https://elsewhere.test' } })) as typeof fetch), /redirected/);
});
test('errors distinguish authentication, permissions and rate limiting without leaking upstream text', async () => {
  for (const [status, pattern] of [[401, /rejected the API key/], [403, /permission/], [429, /limiting requests/]] as const) {
    await assert.rejects(n8nGet('https://demo.app.n8n.cloud', 'fixture-key', 'workflows', {}, (async () => Response.json({ message: 'private upstream secret' }, { status })) as typeof fetch), pattern);
  }
  await assert.rejects(n8nGet('https://demo.app.n8n.cloud', 'fixture-key', 'workflows', {}, (async () => new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } })) as typeof fetch), /web page/);
});
test('workflows preserve editable topology and parameters but exclude credential bindings and unrelated account fields', () => {
  const raw = { id: 'w-1', name: 'Real workflow', active: true, tags: [{ name: 'Commerce' }], nodes: [{ id: 'n-1', name: 'Input', type: 'n8n-nodes-base.webhook', position: [10, 20], parameters: { password: 'secret' }, credentials: { token: 'secret' } }, { id: 'n-2', name: 'Output', type: 'n8n-nodes-base.set', position: [100, 20] }], connections: { Input: { main: [[{ node: 'Output', type: 'main', index: 0 }]] } }, shared: [{ user: { email: 'private@example.com' } }] };
  const result = workflow(raw);
  assert.equal(result.nodes.length, 2); assert.equal(result.active, true);
  assert.deepEqual(result.edges, [{ from: 'Input', to: 'Output', type: 'main', output: 0, input: 0 }]);
  assert.deepEqual(result.tags, ['Commerce']);
  assert.equal(result.nodes[0].parameters.password, 'secret');
  assert.ok(!('credentials' in result.nodes[0])); assert.ok(!JSON.stringify(result).includes('email'));
});
test('executions return metadata only and invalid API shapes fail closed', () => {
  const result = execution({ id: 17, workflowId: 'w-1', status: 'success', data: { resultData: { secret: 'private' } } });
  assert.equal(result.id, '17'); assert.equal(result.status, 'success');
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.throws(() => page({ results: [] }, workflow));
  assert.throws(() => workflow({ title: 'Not n8n' }));
});
