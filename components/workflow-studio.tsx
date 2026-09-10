'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, Box, Braces, Check, ChevronRight, CirclePlay, Clock3, Code2, GitBranch, Globe2, Grip, LoaderCircle, MessageSquareText, MousePointer2, Plus, Save, Search, Trash2, Webhook, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Workflow, WorkflowDraft, WorkflowNode } from '@/lib/n8n-types';

type Props = { workflow: Workflow | null; instanceUrl?: string; onClose: () => void; onChanged: () => Promise<void> | void };
type LibraryItem = { label: string; type: string; version: number; icon: typeof Webhook; description: string; parameters: Record<string, unknown> };
const library: LibraryItem[] = [
  { label: 'Webhook', type: 'n8n-nodes-base.webhook', version: 2, icon: Webhook, description: 'Receive data from another app', parameters: { httpMethod: 'POST', path: 'new-workflow' } },
  { label: 'Schedule', type: 'n8n-nodes-base.scheduleTrigger', version: 1.2, icon: Clock3, description: 'Run on a recurring schedule', parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } } },
  { label: 'Manual trigger', type: 'n8n-nodes-base.manualTrigger', version: 1, icon: CirclePlay, description: 'Start a workflow by hand', parameters: {} },
  { label: 'Edit fields', type: 'n8n-nodes-base.set', version: 3.4, icon: Box, description: 'Shape or add data', parameters: {} },
  { label: 'Condition', type: 'n8n-nodes-base.if', version: 2.2, icon: GitBranch, description: 'Route data using a rule', parameters: {} },
  { label: 'HTTP request', type: 'n8n-nodes-base.httpRequest', version: 4.2, icon: Globe2, description: 'Call an external API', parameters: { url: '' } },
  { label: 'Code', type: 'n8n-nodes-base.code', version: 2, icon: Code2, description: 'Transform data with JavaScript', parameters: { jsCode: 'return $input.all();' } },
  { label: 'Respond', type: 'n8n-nodes-base.respondToWebhook', version: 1.4, icon: Braces, description: 'Return a webhook response', parameters: {} },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const requestHeaders = new Headers(init?.headers); requestHeaders.set('Content-Type', 'application/json');
  const response = await fetch(`/api/n8n${path}`, { ...init, credentials: 'same-origin', cache: 'no-store', headers: requestHeaders });
  const body: unknown = await response.json().catch(() => ({}));
  const errorBody = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof errorBody.error === 'string' ? errorBody.error : 'n8n could not complete this action.');
  return body as T;
}
function iconFor(type: string) { return library.find(item => item.type === type)?.icon || Box; }
function cleanType(type: string) { return type.replace(/^n8n-nodes-base\./, '').replace(/^@n8n\/n8n-nodes-langchain\./, ''); }
function uniqueName(label: string, nodes: WorkflowNode[]) { let name = label, number = 2; while (nodes.some(node => node.name === name)) name = `${label} ${number++}`; return name; }
function draftOf(workflow: Workflow): WorkflowDraft { return { name: workflow.name, nodes: workflow.nodes, edges: workflow.edges, settings: workflow.settings || {} }; }

export function WorkflowStudio({ workflow: initial, instanceUrl, onClose, onChanged }: Props) {
  const [workflow, setWorkflow] = useState<Workflow>(() => initial || { id: '', name: 'Untitled workflow', active: false, archived: false, updatedAt: null, tags: [], nodes: [], edges: [], settings: {} });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'build' | 'ai'>('build');
  const [libraryOpen, setLibraryOpen] = useState(!initial?.id);
  const [query, setQuery] = useState('');
  const [scale, setScale] = useState(.86);
  const [offset, setOffset] = useState({ x: 150, y: 160 });
  const [busy, setBusy] = useState(initial?.id ? 'loading' : '');
  const [message, setMessage] = useState(initial?.id ? 'Loading full workflow…' : 'New draft · not saved');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(!initial?.id);
  const [parametersText, setParametersText] = useState('{}');
  const drag = useRef<{ id: string; startX: number; startY: number; origin: [number, number] } | null>(null);
  const selected = workflow.nodes.find(node => node.id === selectedId) || null;

  useEffect(() => {
    if (!initial?.id) return;
    let canceled = false;
    void api<Workflow>(`?workflowId=${encodeURIComponent(initial.id)}`).then(detail => {
      if (!canceled) { setWorkflow(detail); setSelectedId(null); setLibraryOpen(false); setMessage('Synced from n8n'); requestAnimationFrame(() => fit(detail.nodes, true)); }
    }).catch(issue => { if (!canceled) setError(issue instanceof Error ? issue.message : 'Could not load workflow.'); }).finally(() => { if (!canceled) setBusy(''); });
    return () => { canceled = true; };
  }, [initial?.id]);
  useEffect(() => { setParametersText(JSON.stringify(selected?.parameters || {}, null, 2)); }, [selectedId, selected?.parameters]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag.current) return;
      const { id, startX, startY, origin } = drag.current;
      setWorkflow(old => ({ ...old, nodes: old.nodes.map(node => node.id === id ? { ...node, position: [Math.round(origin[0] + (event.clientX - startX) / scale), Math.round(origin[1] + (event.clientY - startY) / scale)] } : node) }));
      setDirty(true);
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [scale]);
  const filtered = library.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  const byName = useMemo(() => new Map(workflow.nodes.map(node => [node.name, node])), [workflow.nodes]);

  function fit(nodes = workflow.nodes, fullCanvas = false) {
    if (!nodes.length) { setScale(.9); setOffset({ x: 240, y: 180 }); return; }
    const minX = Math.min(...nodes.map(n => n.position[0])), maxX = Math.max(...nodes.map(n => n.position[0]));
    const minY = Math.min(...nodes.map(n => n.position[1])), maxY = Math.max(...nodes.map(n => n.position[1]));
    const availableWidth = Math.max(420, window.innerWidth - (fullCanvas ? 0 : libraryOpen ? 284 : 0) - (fullCanvas ? 0 : selected || mode === 'ai' ? 326 : 0));
    const availableHeight = Math.max(380, window.innerHeight - 150);
    const next = Math.max(.3, Math.min(1.08, (availableWidth - 140) / Math.max(500, maxX - minX + 220), (availableHeight - 140) / Math.max(300, maxY - minY + 104)));
    setScale(next); setOffset({ x: Math.max(60, (availableWidth - (maxX - minX + 220) * next) / 2 - minX * next), y: Math.max(70, (availableHeight - (maxY - minY + 104) * next) / 2 - minY * next) });
  }
  function addNode(item: LibraryItem) {
    const prior = selected || workflow.nodes.at(-1);
    const name = uniqueName(item.label, workflow.nodes);
    const node: WorkflowNode = { id: crypto.randomUUID(), name, type: item.type, typeVersion: item.version, disabled: false, position: prior ? [prior.position[0] + 300, prior.position[1]] : [80, 120], parameters: item.parameters };
    setWorkflow(old => ({ ...old, nodes: [...old.nodes, node], edges: prior ? [...old.edges, { from: prior.name, to: name, type: 'main', output: 0, input: 0 }] : old.edges }));
    setSelectedId(node.id); setDirty(true); setMessage('Unsaved changes'); setLibraryOpen(false);
  }
  function updateNode(change: Partial<WorkflowNode>) {
    if (!selected) return;
    const oldName = selected.name;
    setWorkflow(old => ({ ...old, nodes: old.nodes.map(node => node.id === selected.id ? { ...node, ...change } : node), edges: change.name ? old.edges.map(edge => ({ ...edge, from: edge.from === oldName ? change.name! : edge.from, to: edge.to === oldName ? change.name! : edge.to })) : old.edges }));
    setDirty(true); setMessage('Unsaved changes');
  }
  function removeNode() {
    if (!selected) return;
    setWorkflow(old => ({ ...old, nodes: old.nodes.filter(node => node.id !== selected.id), edges: old.edges.filter(edge => edge.from !== selected.name && edge.to !== selected.name) }));
    setSelectedId(null); setDirty(true); setMessage('Unsaved changes');
  }
  function applyParameters() {
    try { const value = JSON.parse(parametersText); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); updateNode({ parameters: value }); setError(''); }
    catch { setError('Parameters must be a valid JSON object.'); }
  }
  async function save() {
    setBusy('save'); setError('');
    try {
      const path = workflow.id ? `?operation=update&workflowId=${encodeURIComponent(workflow.id)}` : '?operation=create';
      const saved = await api<Workflow>(path, { method: workflow.id ? 'PUT' : 'POST', body: JSON.stringify(draftOf(workflow)) });
      setWorkflow(saved); setDirty(false); setMessage('Saved to n8n'); await onChanged();
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not save workflow.'); }
    finally { setBusy(''); }
  }
  async function toggleActive() {
    if (!workflow.id) { setError('Save this workflow before activating it.'); return; }
    setBusy('active'); setError('');
    try { const saved = await api<Workflow>(`?operation=${workflow.active ? 'deactivate' : 'activate'}&workflowId=${encodeURIComponent(workflow.id)}`, { method: 'POST', body: '{}' }); setWorkflow(saved); setMessage(saved.active ? 'Workflow activated' : 'Workflow paused'); await onChanged(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not change workflow status.'); }
    finally { setBusy(''); }
  }
  return <main className="studio-shell">
    <header className="studio-topbar">
      <div className="studio-title-group"><button className="studio-icon-button" onClick={onClose} aria-label="Back to workspace"><ArrowLeft size={19} /></button><span className="studio-brand-mark" /><div><span className="studio-kicker">WORKFLOW STUDIO</span><Input className="studio-name" value={workflow.name} aria-label="Workflow name" onChange={event => { setWorkflow(old => ({ ...old, name: event.target.value })); setDirty(true); setMessage('Unsaved changes'); }} /></div></div>
      <div className="studio-state"><span className={`studio-sync ${error ? 'has-error' : dirty ? 'is-dirty' : ''}`}>{busy ? <LoaderCircle size={13} className="spin-icon" /> : error ? <X size={13} /> : dirty ? <span /> : <Check size={13} />}{error || message}</span><button className={`studio-status ${workflow.active ? 'is-active' : ''}`} onClick={() => void toggleActive()} disabled={!!busy}><span />{workflow.active ? 'Active' : 'Inactive'}</button><Button variant="outline" onClick={() => void save()} disabled={!!busy || !workflow.name.trim()}><Save size={15} />{busy === 'save' ? 'Saving…' : 'Save to n8n'}</Button></div>
    </header>
    <section className={`studio-workspace ${libraryOpen ? 'has-library' : ''} ${selected || mode === 'ai' ? 'has-inspector' : ''}`}>
      {libraryOpen && <aside className="node-library is-open"><div className="library-head"><div><span className="studio-kicker">BUILD</span><h2>Add a step</h2></div><button onClick={() => setLibraryOpen(false)} aria-label="Close node library"><X size={17} /></button></div><div className="library-search"><Search size={15} /><Input placeholder="Search steps" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="library-list">{filtered.map(item => { const Icon = item.icon; return <button key={item.type} onClick={() => addNode(item)}><span><Icon size={18} /></span><div><strong>{item.label}</strong><small>{item.description}</small></div><Plus size={14} /></button>; })}</div><p className="library-note">This starter library uses native n8n nodes. Existing community and AI nodes remain visible and editable when loaded.</p></aside>}
      <div className="studio-canvas" onWheel={event => { event.preventDefault(); setScale(old => Math.max(.32, Math.min(1.5, old - event.deltaY * .0007))); }}>
        <div className="canvas-grid" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}>
          <svg className="studio-edges" width="4000" height="2600" aria-hidden="true">{workflow.edges.map((edge, index) => { const from = byName.get(edge.from), to = byName.get(edge.to); if (!from || !to) return null; const x1 = from.position[0] + 220, y1 = from.position[1] + 52, x2 = to.position[0], y2 = to.position[1] + 52, bend = Math.max(70, Math.abs(x2 - x1) * .45); return <g key={`${edge.from}-${edge.to}-${index}`}><path className="edge-halo" d={`M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`} /><path className="edge-line" d={`M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`} /></g>; })}</svg>
          {workflow.nodes.map((node, index) => { const Icon = iconFor(node.type); return <button key={node.id} className={`studio-node ${selectedId === node.id ? 'is-selected' : ''} ${node.disabled ? 'is-disabled' : ''}`} style={{ transform: `translate(${node.position[0]}px, ${node.position[1]}px)` }} onClick={event => { event.stopPropagation(); setSelectedId(node.id); }} onPointerDown={event => { if ((event.target as HTMLElement).closest('.node-drag')) drag.current = { id: node.id, startX: event.clientX, startY: event.clientY, origin: node.position }; }}><span className="node-input" /><span className="node-drag"><Grip size={13} /></span><span className="node-icon"><Icon size={23} strokeWidth={1.6} /></span><span className="node-copy"><small>{index === 0 ? 'TRIGGER / ENTRY' : cleanType(node.type).toUpperCase()}</small><strong>{node.name}</strong></span><span className="node-output" /></button>; })}
          {!workflow.nodes.length && <button className="canvas-empty" onClick={() => setLibraryOpen(true)}><span><Plus size={22} /></span><strong>Start with a trigger</strong><small>Add your first n8n step</small></button>}
        </div>
        <div className="canvas-toolbar"><button onClick={() => setLibraryOpen(true)}><Plus size={17} /> Add step</button><span /><button onClick={() => setScale(old => Math.max(.32, old - .1))} aria-label="Zoom out"><ZoomOut size={17} /></button><button onClick={() => fit()}><MousePointer2 size={16} /> Fit</button><button onClick={() => setScale(old => Math.min(1.5, old + .1))} aria-label="Zoom in"><ZoomIn size={17} /></button><em>{Math.round(scale * 100)}%</em></div>
      </div>
      {(selected || mode === 'ai') && <aside className={`node-inspector ${mode === 'ai' ? 'ai-mode' : ''}`}>{mode === 'ai' ? <AiPanel onBuild={() => setMode('build')} /> : selected && <><div className="inspector-head"><div><span className="studio-kicker">STEP SETTINGS</span><h2>{selected.name}</h2></div><button onClick={() => setSelectedId(null)} aria-label="Close step settings"><X size={17} /></button></div><label className="inspector-field"><span>Name</span><Input value={selected.name} onChange={event => updateNode({ name: event.target.value })} /></label><label className="inspector-field"><span>n8n node type</span><Input value={selected.type} disabled /></label><label className="inspector-check"><input type="checkbox" checked={selected.disabled} onChange={event => updateNode({ disabled: event.target.checked })} /><span>Disable this step</span></label><label className="inspector-field grow"><span>Parameters <small>JSON</small></span><Textarea spellCheck={false} value={parametersText} onChange={event => setParametersText(event.target.value)} onBlur={applyParameters} /></label><div className="inspector-actions"><Button variant="outline" onClick={applyParameters}>Apply parameters</Button><button className="delete-node" onClick={removeNode}><Trash2 size={15} /> Remove step</button></div></>}</aside>}
    </section>
    <nav className="studio-mode-dock"><button className={mode === 'build' ? 'active' : ''} onClick={() => setMode('build')}><Grip size={15} /> Build</button><button className={mode === 'ai' ? 'active' : ''} onClick={() => setMode('ai')}><MessageSquareText size={15} /> AI chat <span>OPTIONAL</span></button></nav>
    <footer className="studio-footer"><span>{workflow.nodes.length} steps</span><span>{workflow.edges.length} connections</span><span>n8n is the source of truth</span>{workflow.id && instanceUrl && <a href={`${instanceUrl}/workflow/${encodeURIComponent(workflow.id)}`} target="_blank" rel="noreferrer">Open in n8n <ChevronRight size={13} /></a>}</footer>
  </main>;
}

function AiPanel({ onBuild }: { onBuild: () => void }) {
  return <div className="ai-panel"><div className="inspector-head"><div><span className="studio-kicker">OPTIONAL MODE</span><h2>AI workflow chat</h2></div><Bot size={20} /></div><div className="ai-orb"><Bot size={25} /></div><h3>Bring your own n8n builder</h3><p>The public n8n API does not expose n8n’s built-in AI assistant. To keep this honest and reliable, chat connects to a dedicated AI-builder workflow in your n8n account instead of pretending a local rule engine is AI.</p><div className="ai-setup"><span>SETUP REQUIRED</span><strong>AI builder webhook</strong><small>Create or import the builder workflow, then connect its webhook here.</small></div><Button variant="outline" disabled>Connect builder webhook</Button><button className="text-action" onClick={onBuild}>Continue building manually</button></div>;
}
