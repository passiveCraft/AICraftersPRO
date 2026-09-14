'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, CircleAlert, Eye, EyeOff, Link2, LoaderCircle, RefreshCw, Search, Unplug, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Execution, ExecutionDetail, Page, Snapshot, Workflow } from '@/lib/n8n-types';

const empty: Snapshot = { connected: false, workflows: { data: [], nextCursor: null }, executions: { data: [], nextCursor: null }, credentials: [] };
export async function n8nClientRequest<T>(path = '', init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api/n8n${path}`, { ...init, credentials: 'same-origin', cache: 'no-store', headers });
  let body;
  try { body = await response.json(); } catch { throw new Error('The dashboard could not read the response. Please try again.'); }
  if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Could not complete the n8n request.');
  return body as T;
}
export function useN8n() {
  const [data, setData] = useState<Snapshot>(empty);
  const [busy, setBusy] = useState('loading');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const inFlight = useRef(true);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const current = ++generation.current;
    setBusy('sync');
    try {
      const next = await n8nClientRequest<Snapshot>();
      if (generation.current === current) { setData(next); setError(''); }
    } catch (issue) { if (generation.current === current) setError(issue instanceof Error ? issue.message : 'Connection failed.'); }
    finally { inFlight.current = false; if (generation.current === current) setBusy(''); }
  }, []);
  useEffect(() => {
    let canceled = false;
    void n8nClientRequest<Snapshot>().then(next => { if (!canceled) { setData(next); setError(''); } }).catch(issue => { if (!canceled) setError(issue instanceof Error ? issue.message : 'Connection failed.'); }).finally(() => { if (!canceled) { inFlight.current = false; setBusy(''); } });
    return () => { canceled = true; };
  }, []);
  async function connect(instanceUrl: string, apiKey: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    const current = ++generation.current; setBusy('connect'); setError('');
    try {
      const next = await n8nClientRequest<Snapshot>('', { method: 'POST', body: JSON.stringify({ instanceUrl, apiKey }) });
      if (current === generation.current) setData(next);
      return true;
    } catch (issue) { if (current === generation.current) setError(issue instanceof Error ? issue.message : 'Connection failed.'); return false; }
    finally { inFlight.current = false; if (current === generation.current) setBusy(''); }
  }
  async function disconnect() {
    if (inFlight.current) return;
    inFlight.current = true;
    const current = ++generation.current; setBusy('disconnect'); setError('');
    try { await n8nClientRequest('', { method: 'DELETE' }); if (current === generation.current) setData(empty); }
    catch (issue) { if (current === generation.current) setError(issue instanceof Error ? issue.message : 'Disconnect failed.'); }
    finally { inFlight.current = false; if (current === generation.current) setBusy(''); }
  }
  async function loadMore(resource: 'workflows' | 'executions') {
    const cursor = data[resource].nextCursor;
    if (!cursor || busy || inFlight.current) return;
    inFlight.current = true;
    const current = ++generation.current; setBusy(resource); setError('');
    try {
      if (resource === 'workflows') {
        const next = await n8nClientRequest<Page<Workflow>>(`?resource=workflows&cursor=${encodeURIComponent(cursor)}`);
        if (current === generation.current) setData(old => ({ ...old, workflows: { data: [...old.workflows.data, ...next.data.filter(w => !old.workflows.data.some(v => v.id === w.id))], nextCursor: next.nextCursor } }));
      } else {
        const next = await n8nClientRequest<Page<Execution>>(`?resource=executions&cursor=${encodeURIComponent(cursor)}`);
        if (current === generation.current) setData(old => ({ ...old, executions: { data: [...old.executions.data, ...next.data.filter(e => !old.executions.data.some(v => v.id === e.id))], nextCursor: next.nextCursor } }));
      }
    } catch (issue) { if (current === generation.current) setError(issue instanceof Error ? issue.message : 'Could not load the next page.'); }
    finally { inFlight.current = false; if (current === generation.current) setBusy(''); }
  }
  return { data, busy, error, refresh, connect, disconnect, loadMore };
}
export type N8nState = ReturnType<typeof useN8n>;
function date(value?: string | null) { if (!value) return 'Not available'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

export function ConnectionPanel({ state }: { state: N8nState }) {
  const { data, busy, error } = state;
  const [instance, setInstance] = useState(data.instanceUrl || '');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const connected = data.connected && !editing;
  return <div className="integration-content">
    {error && <p className="integration-error" role="alert">{error}</p>}
    {connected ? <>
      <div className="connected-card"><span className="connected-emblem"><Check size={22} /></span><div><h2>n8n connected</h2><p>{new URL(data.instanceUrl!).hostname}</p></div></div>
      <dl className="account-facts"><div><dt>Instance</dt><dd><a href={data.instanceUrl} target="_blank" rel="noreferrer">Open n8n <ArrowUpRight size={13} /></a></dd></div><div><dt>Environment</dt><dd>{new URL(data.instanceUrl!).hostname.endsWith('.n8n.cloud') ? 'n8n Cloud' : 'Self-hosted / custom domain'}</dd></div><div><dt>Connected</dt><dd>{date(data.connectedAt)}</dd></div><div><dt>Last synced</dt><dd>{date(data.syncedAt)}</dd></div><div><dt>API</dt><dd>Public API / v1</dd></div><div><dt>Workflow access</dt><dd>Verified</dd></div><div><dt>Execution access</dt><dd>{data.executionError ? 'Unavailable' : 'Verified'}</dd></div><div><dt>Saved key</dt><dd>Encrypted · hidden</dd></div></dl>
      {data.executionError && <p className="integration-note">{data.executionError}</p>}
      <div className="panel-actions"><Button variant="outline" disabled={!!busy} onClick={() => void state.refresh()}><RefreshCw size={15} className={busy === 'sync' ? 'spin-icon' : ''} /> {busy === 'sync' ? 'Syncing…' : 'Refresh account'}</Button><Button variant="ghost" disabled={!!busy} onClick={() => { setInstance(data.instanceUrl || ''); setEditing(true); }}>Update connection</Button></div>
      {confirmDisconnect ? <div className="disconnect-confirm"><p>Remove the saved connection from this dashboard? Your workflows in n8n stay intact.</p><Button variant="outline" disabled={!!busy} onClick={() => { void state.disconnect(); setConfirmDisconnect(false); }}>Disconnect</Button><Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>Cancel</Button></div> : <button className="disconnect-link" disabled={!!busy} onClick={() => setConfirmDisconnect(true)}><Unplug size={14} /> Disconnect account</button>}
    </> : <form className="connection-form" onSubmit={async event => { event.preventDefault(); if (await state.connect(instance, key)) { setKey(''); setEditing(false); } }}>
      <div className="form-field"><label htmlFor="n8n-instance">n8n instance URL</label><Input id="n8n-instance" type="url" required placeholder={import.meta.env.DEV ? 'http://localhost:5678' : 'https://your-team.app.n8n.cloud'} value={instance} onChange={event => setInstance(event.target.value)} disabled={busy === 'connect'} autoComplete="url" /><p>{import.meta.env.DEV ? 'This local preview also supports n8n at http://localhost:5678.' : 'Use your n8n Cloud or public self-hosted HTTPS address.'}</p></div>
      <div className="form-field"><label htmlFor="n8n-api-key">API key</label><div className="secret-input"><Input id="n8n-api-key" type={showKey ? 'text' : 'password'} required minLength={8} maxLength={4096} placeholder="Paste your n8n API key" value={key} onChange={event => setKey(event.target.value)} autoComplete="off" spellCheck={false} disabled={busy === 'connect'} /><button type="button" aria-label={showKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><p>Stored encrypted for your signed-in dashboard account.</p></div>
      <div className="key-guide"><span className="eyebrow">IN YOUR N8N ACCOUNT</span><ol><li>Open <strong>Settings → n8n API</strong>.</li><li>Create an API key and copy it here.</li><li>For a scoped key, enable <code>workflow:list</code>, <code>workflow:read</code>, <code>workflow:update</code>, <code>workflow:activate</code>, and <code>execution:list</code>.</li></ol><a href="https://github.com/n8n-io/n8n-docs/blob/main/docs/connect/n8n-api/authentication.md" target="_blank" rel="noreferrer">n8n API key guide <ArrowUpRight size={13} /></a></div>
      <p className="integration-note">Connecting lets this dashboard read workflows and recent executions from the address above. Your key is sent through this dashboard’s server to that n8n instance.</p>
      <Button className="connect-submit" type="submit" disabled={!!busy}>{busy === 'connect' ? <LoaderCircle size={17} className="spin-icon" /> : <Link2 size={17} />}{busy === 'connect' ? 'Verifying and connecting…' : 'Connect n8n'}</Button>
      {editing && <Button type="button" variant="ghost" disabled={!!busy} onClick={() => { setEditing(false); setKey(''); }}>Cancel</Button>}
    </form>}
  </div>;
}

export function WorkflowPanel({ state, onConnect, onOpen, onCreate }: { state: N8nState; onConnect: () => void; onOpen: (workflow: Workflow) => void; onCreate: () => void }) {
  const [query, setQuery] = useState('');
  if (!state.data.connected) return <EmptyPanel onConnect={onConnect} title="A clear workspace." />;
  const items = state.data.workflows.data.filter(item => `${item.name} ${item.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="integration-content">
    {state.error && <p className="integration-error" role="alert">{state.error}</p>}
      <div className="resource-toolbar"><span>{state.data.workflows.data.length}{state.data.workflows.nextCursor ? '+' : ''} workflows</span><div className="resource-actions"><Button size="sm" onClick={onCreate}>New workflow</Button><button aria-label="Refresh workflows" disabled={!!state.busy} onClick={() => void state.refresh()}><RefreshCw size={16} className={state.busy === 'sync' ? 'spin-icon' : ''} /></button></div></div>
      <div className="workflow-filter"><Search size={16} /><Input aria-label="Search loaded workflows by name or tag" placeholder="Search loaded workflows" value={query} onChange={e => setQuery(e.target.value)} /></div>
      {!items.length && <p className="integration-note">{query ? 'No matching workflows in the loaded results.' : 'No workflows are visible to this API key yet.'}</p>}
      <div className="resource-list">{items.map(item => <button className="workflow-row" key={item.id} onClick={() => onOpen(item)}><span className={`workflow-orb ${item.active ? 'live' : ''}`} /><span><strong>{item.name}</strong><small>{item.archived ? 'Archived' : item.active ? 'Active' : 'Inactive'} · {item.nodes.length} nodes{item.tags.length ? ` · ${item.tags.join(', ')}` : ''}</small></span><ChevronRight size={15} /></button>)}</div>
      {state.data.workflows.nextCursor && <Button variant="outline" disabled={!!state.busy} onClick={() => void state.loadMore('workflows')}>{state.busy === 'workflows' ? 'Loading…' : 'Load more workflows'}</Button>}
      <p className="integration-note">Open a workflow to edit it full screen. Saves go directly to your connected n8n account.</p>
  </div>;
}
export function LegacyActivityPanel({ state, onConnect }: { state: N8nState; onConnect: () => void }) {
  if (!state.data.connected) return <EmptyPanel onConnect={onConnect} title="Nothing running yet." />;
  const { executions, executionError, workflows } = state.data;
  return <div className="integration-content"><div className="resource-toolbar"><span>Recent executions</span><button aria-label="Refresh executions" disabled={!!state.busy} onClick={() => void state.refresh()}><RefreshCw size={16} className={state.busy === 'sync' ? 'spin-icon' : ''} /></button></div>
    {(state.error || executionError) && <p className="integration-error" role="alert">{state.error || executionError}</p>}
    {!executions.data.length && !executionError && <p className="integration-note">No executions are available yet. n8n’s history retention settings determine which runs appear.</p>}
    <div className="execution-list">{executions.data.map(item => <a key={item.id} href={`${state.data.instanceUrl}/workflow/${encodeURIComponent(item.workflowId)}/executions/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer"><div><strong>{workflows.data.find(w => w.id === item.workflowId)?.name || `Workflow ${item.workflowId}`}</strong><span className={`state-chip ${item.status === 'success' ? 'success' : ['error', 'crashed'].includes(item.status) ? 'failed' : ''}`}>{item.status}</span></div><small>#{item.id} · {item.mode || 'Execution'} · {date(item.startedAt)}</small><span className="execution-bottom">{item.startedAt && item.stoppedAt ? `${Math.max(0, (Date.parse(item.stoppedAt) - Date.parse(item.startedAt)) / 1000).toFixed(1)}s` : 'No completed duration'}<ArrowUpRight size={14} /></span></a>)}</div>
    {executions.nextCursor && <Button variant="outline" disabled={!!state.busy} onClick={() => void state.loadMore('executions')}>{state.busy === 'executions' ? 'Loading…' : 'Load older executions'}</Button>}
    <p className="integration-note">Open an execution to inspect its full output in n8n.</p>
  </div>;
}
export function ActivityPanel({ state, onConnect }: { state: N8nState; onConnect: () => void }) {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [loadingId, setLoadingId] = useState('');
  if (!state.data.connected) return <EmptyPanel onConnect={onConnect} title="Nothing running yet." />;
  const { executions, executionError, workflows } = state.data;
  async function inspect(item: Execution) { setLoadingId(item.id); try { setDetail(await n8nClientRequest<ExecutionDetail>(`?resource=execution&executionId=${encodeURIComponent(item.id)}`)); } catch { setDetail({ ...item, lastNode: null, steps: [], error: 'Execution details are unavailable for this run.' }); } finally { setLoadingId(''); } }
  return <div className="integration-content"><div className="resource-toolbar"><span>Recent executions</span><button aria-label="Refresh executions" disabled={!!state.busy} onClick={() => void state.refresh()}><RefreshCw size={16} className={state.busy === 'sync' ? 'spin-icon' : ''} /></button></div>
    {(state.error || executionError) && <p className="integration-error" role="alert">{state.error || executionError}</p>}
    {!executions.data.length && !executionError && <p className="integration-note">No executions are available yet. n8n’s history retention settings determine which runs appear.</p>}
    <div className="execution-list">{executions.data.map(item => <button key={item.id} onClick={() => void inspect(item)}><div><strong>{workflows.data.find(w => w.id === item.workflowId)?.name || `Workflow ${item.workflowId}`}</strong><span className={`state-chip ${item.status === 'success' ? 'success' : ['error', 'crashed'].includes(item.status) ? 'failed' : ''}`}>{item.status}</span></div><small>#{item.id} · {item.mode || 'Execution'} · {date(item.startedAt)}</small><span className="execution-bottom">{loadingId === item.id ? 'Reading run…' : item.startedAt && item.stoppedAt ? `${Math.max(0, (Date.parse(item.stoppedAt) - Date.parse(item.startedAt)) / 1000).toFixed(1)}s` : 'Inspect run'}<ChevronRight size={14} /></span></button>)}</div>
    {detail && <ExecutionInspector detail={detail} instanceUrl={state.data.instanceUrl} onClose={() => setDetail(null)} />}
    {executions.nextCursor && <Button variant="outline" disabled={!!state.busy} onClick={() => void state.loadMore('executions')}>{state.busy === 'executions' ? 'Loading…' : 'Load older executions'}</Button>}
    <p className="integration-note">Select a run to see the failed node, n8n’s message, and its output here.</p>
  </div>;
}

function answerOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(answerOf).filter(Boolean).join('\n');
  if (!value || typeof value !== 'object') return typeof value === 'bigint' ? value.toString() : '';
  const data = value as Record<string, unknown>;
  if (typeof data.answer === 'string') return data.answer;
  if (typeof data.text === 'string') return data.text;
  const parts = data.content && typeof data.content === 'object' ? (data.content as Record<string, unknown>).parts : undefined;
  if (Array.isArray(parts)) { const text = parts.map(answerOf).filter(Boolean).join('\n'); if (text) return text; }
  return JSON.stringify(value, null, 2);
}

function ExecutionInspector({ detail, instanceUrl, onClose }: { detail: ExecutionDetail; instanceUrl?: string; onClose: () => void }) {
  return <section className={`run-inspector ${detail.error ? 'has-failure' : ''}`} aria-label={`Execution ${detail.id} details`}><header><div><span>EXECUTION #{detail.id}</span><strong>{detail.error ? 'Run diagnosis' : 'Run output'}</strong></div><button onClick={onClose} aria-label="Close run details"><X size={16} /></button></header>{detail.error && <div className="run-diagnosis"><CircleAlert size={18} /><div><strong>{detail.lastNode || 'Workflow error'}</strong><p>{detail.error}</p>{detail.hint && <small>{detail.hint}</small>}</div></div>}<div className="run-step-list">{detail.steps.map(step => <div key={step.name} className={step.status}><span>{step.status === 'error' ? <CircleAlert size={14} /> : <Check size={14} />}</span><div><strong>{step.name}</strong><small>{step.status}{step.durationMs !== null ? ` · ${step.durationMs}ms` : ''}</small></div></div>)}</div>{detail.output !== undefined && <div className="creation-output"><span>OUTPUT</span><p>{answerOf(detail.output)}</p></div>}{instanceUrl && <a className="run-native-link" href={`${instanceUrl}/workflow/${encodeURIComponent(detail.workflowId)}/executions/${encodeURIComponent(detail.id)}`} target="_blank" rel="noreferrer">Open raw execution in n8n <ArrowUpRight size={14} /></a>}</section>;
}

function EmptyPanel({ title, onConnect }: { title: string; onConnect: () => void }) { return <div className="panel-empty"><div className="empty-glyph"><Link2 size={27} strokeWidth={1} /></div><h2>{title}</h2><p>Connect your n8n account to bring its workflows and activity into view.</p><Button variant="outline" onClick={onConnect}>Connect n8n <ArrowUpRight size={15} /></Button></div>; }
