import { env } from 'cloudflare:workers';
import { handleN8nRequest, type Bindings } from './n8n-handler';
export function handleN8n(request: Request) {
  const localPreview = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);
  return handleN8nRequest(request, env as unknown as Bindings, fetch, localPreview);
}
