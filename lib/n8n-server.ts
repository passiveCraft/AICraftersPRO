import { env } from 'cloudflare:workers';
import { handleN8nRequest, type Bindings } from './n8n-handler';
export function handleN8n(request: Request) {
  const localPreview = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);
  if (localPreview && !request.headers.get('oai-authenticated-user-id')) {
    const headers = new Headers(request.headers);
    headers.set('oai-authenticated-user-id', 'local-dev-user');
    request = new Request(request.url, { method: request.method, headers, body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body });
  }
  return handleN8nRequest(request, env as unknown as Bindings, fetch, localPreview);
}
