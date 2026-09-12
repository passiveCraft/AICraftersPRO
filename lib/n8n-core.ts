import type { Execution, Page, Workflow } from './n8n-types';

export class ConnectionError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function normalizeInstance(input: string, allowLocal = false): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new ConnectionError('Enter a complete n8n URL, starting with https://.'); }
  const host = url.hostname.toLowerCase();
  if (allowLocal && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(host) && url.port === '5678' && !url.username && !url.password && !url.search && !url.hash && ['', '/', '/api/v1', '/api/v1/'].includes(url.pathname)) return 'http://localhost:5678';
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new ConnectionError('Use the public HTTPS address of your n8n instance, without login details or a custom port.');
  }
  if (!host.includes('.') || !/^[a-z0-9.-]+$/.test(host) || /^[\d.]+$/.test(host) || /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) || host.endsWith('.')) {
    throw new ConnectionError('Use a publicly reachable n8n hostname. Local or private addresses cannot be reached by this hosted dashboard.');
  }
  if (url.search || url.hash || /%|\\/.test(url.pathname)) throw new ConnectionError('Use the instance base URL, without a query or a workflow link.');
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  if (/\/(workflow|workflows|home|settings|executions)(\/|$)/.test(url.pathname)) throw new ConnectionError('Paste your instance base URL, not an editor or settings page.');
  return url.toString().replace(/\/$/, '');
}

export function isPublicAddress(address: string): boolean {
  if (address.includes(':')) {
    // Accept global unicast only; exclude mapped IPv4, local, multicast and documentation ranges.
    return /^[23][0-9a-f]{0,3}:/i.test(address) && !/^2001:(db8|0|2|10|20):/i.test(address) && !address.startsWith('2002:');
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

export async function checkPublicHost(instance: string, fetcher: typeof fetch = fetch) {
  const hostname = new URL(instance).hostname;
  const records = await Promise.all(['A', 'AAAA'].map(async type => {
    let response: Response;
    try { response = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(8000), redirect: 'error' }); }
    catch { throw new ConnectionError('The instance hostname could not be verified. Check the URL and try again.', 502); }
    if (!response.ok) throw new ConnectionError('The instance hostname could not be verified. Try again.', 502);
    const data = await response.json() as { Answer?: { type: number; data: string }[] };
    return (data.Answer || []).filter(r => r.type === 1 || r.type === 28).map(r => r.data);
  }));
  const addresses = records.flat();
  if (!addresses.length || addresses.some(address => !isPublicAddress(address))) throw new ConnectionError('This address does not resolve to a public n8n server. Use its public HTTPS domain.');
}

export async function encryptKey(value: string, owner: string, secret: string) {
  const key = await cryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(owner) }, key, new TextEncoder().encode(value));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}
export async function decryptKey(value: string, owner: string, secret: string) {
  try {
    const [iv, content] = value.split('.');
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv), additionalData: new TextEncoder().encode(owner) }, await cryptoKey(secret), fromBase64(content));
    return new TextDecoder().decode(plaintext);
  } catch { throw new ConnectionError('The saved connection cannot be opened. Reconnect with your n8n API key.', 409); }
}
async function cryptoKey(secret: string) {
  if (!/^[0-9a-f]{64}$/i.test(secret || '')) throw new ConnectionError('Secure connection storage is not configured yet.', 503);
  const bytes = new Uint8Array(secret.match(/.{2}/g)!.map(n => parseInt(n, 16)));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
function toBase64(value: Uint8Array) { return btoa(String.fromCharCode(...value)); }
function fromBase64(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }

export async function n8nRequest(instance: string, key: string, resource: string, options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; query?: Record<string, string>; body?: unknown } = {}, fetcher: typeof fetch = fetch): Promise<unknown> {
  if (!/^(workflows|executions)(\/[a-zA-Z0-9_-]+)?(\/(activate|deactivate))?$/.test(resource)) throw new ConnectionError('Unsupported n8n resource.');
  const url = new URL(`${instance}/api/v1/${resource}`);
  for (const [name, value] of Object.entries(options.query || {})) url.searchParams.set(name, value);
  let response: Response;
  try { response = await fetcher(url, { method: options.method || 'GET', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-N8N-API-KEY': key }, body: options.body === undefined ? undefined : JSON.stringify(options.body), redirect: 'manual', signal: AbortSignal.timeout(15000), cache: 'no-store' }); }
  catch { throw new ConnectionError('Could not reach n8n. Check that the instance is online at the configured address, then refresh.', 502); }
  if (response.status >= 300 && response.status < 400) throw new ConnectionError('n8n redirected the request. Enter the final HTTPS instance URL; redirects are not followed with your API key.');
  if (response.status === 401) throw new ConnectionError('n8n rejected the API key. Check the key and its expiration date.', 401);
  if (response.status === 403) throw new ConnectionError(`Your API key does not have permission to ${options.method && options.method !== 'GET' ? 'change' : 'read'} ${resource.split('/')[0]}. Check its scopes in n8n.`, 403);
  if (response.status === 404) throw new ConnectionError('The n8n API or requested resource was not found. Check the base URL and API availability on your plan.', 404);
  if (response.status === 429) throw new ConnectionError('n8n is limiting requests. Wait a moment, then refresh.', 429);
  if (!response.ok) throw new ConnectionError(`n8n returned an error (${response.status}). Check your instance and try again.`, 502);
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new ConnectionError('This address returned a web page rather than the n8n API. Check the URL and any proxy sign-in requirements.');
  const reader = response.body?.getReader();
  if (!reader) throw new ConnectionError('n8n returned an empty response.', 502);
  const decoder = new TextDecoder(); let result = '', size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 6_000_000) { await reader.cancel(); throw new ConnectionError('This n8n response is too large. Try a smaller workflow page.', 413); } result += decoder.decode(value, { stream: true }); }
    result += decoder.decode();
    return JSON.parse(result);
  } catch (error) { if (error instanceof ConnectionError) throw error; throw new ConnectionError('n8n returned an unreadable response. Please try again.', 502); }
}
export async function n8nGet(instance: string, key: string, resource: string, query: Record<string, string> = {}, fetcher: typeof fetch = fetch): Promise<unknown> {
  return n8nRequest(instance, key, resource, { query }, fetcher);
}

type RecordData = Record<string, unknown>;
function record(value: unknown): RecordData { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {}; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function str(value: unknown): string { return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''; }
export function workflow(value: unknown): Workflow {
  const data = record(value);
  if (!str(data.id) || typeof data.name !== 'string') throw new ConnectionError('The API response does not contain valid n8n workflows.', 502);
  const nodes = list(data.nodes).map((v, index) => { const n = record(v); const pos = list(n.position); return { id: str(n.id) || String(index), name: str(n.name), type: str(n.type), typeVersion: Number(n.typeVersion) || 1, disabled: n.disabled === true, position: [Number(pos[0]) || 0, Number(pos[1]) || 0] as [number, number], parameters: record(n.parameters) }; });
  const edges: Workflow['edges'] = [];
  for (const [from, types] of Object.entries(record(data.connections))) {
    for (const [type, outputs] of Object.entries(record(types))) {
      for (const [outputIndex, output] of list(outputs).entries()) for (const item of list(output)) { const edge = record(item); if (str(edge.node)) edges.push({ from, to: str(edge.node), type, output: outputIndex, input: Number(edge.index) || 0 }); }
    }
  }
  return { id: str(data.id), name: str(data.name), active: data.active === true, archived: data.isArchived === true, updatedAt: str(data.updatedAt) || null, tags: list(data.tags).map(t => str(record(t).name)).filter(Boolean), nodes, edges, settings: record(data.settings) };
}
export function execution(value: unknown): Execution {
  const data = record(value);
  if (!str(data.id)) throw new ConnectionError('The API response does not contain valid n8n executions.', 502);
  return { id: str(data.id), workflowId: str(data.workflowId), status: str(data.status) || (data.finished ? 'finished' : 'unknown'), mode: str(data.mode), startedAt: str(data.startedAt) || null, stoppedAt: str(data.stoppedAt) || null };
}
export function page<T>(value: unknown, mapper: (v: unknown) => T): Page<T> {
  const data = record(value);
  if (!Array.isArray(data.data)) throw new ConnectionError('The address did not return the expected n8n API data.', 502);
  return { data: data.data.map(mapper), nextCursor: str(data.nextCursor) || null };
}
