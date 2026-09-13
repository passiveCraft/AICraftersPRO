'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, Box, Braces, Check, ChevronDown, ChevronRight, ChevronUp, CircleAlert, CirclePlay, Clock3, Code2, Copy, Download, FileUp, GitBranch, Globe2, Grip, LoaderCircle, MessageSquareText, MousePointer2, Play, Plus, Redo2, Save, Search, TerminalSquare, Trash2, Undo2, Webhook, X, ZoomIn, ZoomOut } from 'lucide-react';
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
  { label: 'Google Gemini', type: '@n8n/n8n-nodes-langchain.googleGemini', version: 1.1, icon: Bot, description: 'Create text with a Gemini model', parameters: { resource: 'text', operation: 'message', modelId: { __rl: true, value: 'models/gemini-2.5-flash', mode: 'list' }, messages: { values: [{ role: 'user', content: '={{ $json.prompt }}' }] }, simplify: true, builtInTools: {}, options: {} } },
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
function credentialRequirement(node: WorkflowNode) { return /googleGemini|lmChatGoogleGemini/i.test(node.type) && !node.credentialTypes?.includes('googlePalmApi') ? 'Google Gemini credential' : ''; }
function uniqueName(label: string, nodes: WorkflowNode[]) { let name = label, number = 2; while (nodes.some(node => node.name === name)) name = `${label} ${number++}`; return name; }
function draftOf(workflow: Workflow): WorkflowDraft { return { name: workflow.name, nodes: workflow.nodes, edges: workflow.edges, settings: workflow.settings || {} }; }
function importedWorkflow(value: unknown): Workflow {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const nodes: WorkflowNode[] = rawNodes.map((value, index) => { const node = value && typeof value === 'object' ? value as Record<string, unknown> : {}; const position = Array.isArray(node.position) ? node.position : []; return { id: typeof node.id === 'string' ? node.id : crypto.randomUUID(), name: typeof node.name === 'string' ? node.name : `Step ${index + 1}`, type: typeof node.type === 'string' ? node.type : 'n8n-nodes-base.set', typeVersion: Number(node.typeVersion) || 1, disabled: node.disabled === true, position: [Number(position[0]) || index * 280, Number(position[1]) || 100], parameters: node.parameters && typeof node.parameters === 'object' && !Array.isArray(node.parameters) ? node.parameters as Record<string, unknown> : {} }; });
  const edges: Workflow['edges'] = []; const connections = data.connections && typeof data.connections === 'object' ? data.connections as Record<string, unknown> : {};
  for (const [from, groups] of Object.entries(connections)) if (groups && typeof groups === 'object') for (const [type, outputs] of Object.entries(groups as Record<string, unknown>)) if (Array.isArray(outputs)) outputs.forEach((output, outputIndex) => { if (Array.isArray(output)) output.forEach(value => { const edge = value && typeof value === 'object' ? value as Record<string, unknown> : {}; if (typeof edge.node === 'string') edges.push({ from, to: edge.node, type, output: outputIndex, input: Number(edge.index) || 0 }); }); });
  return { id: '', name: typeof data.name === 'string' ? `${data.name} · imported` : 'Imported workflow', active: false, archived: false, updatedAt: null, tags: [], nodes, edges, settings: data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings) ? data.settings as Record<string, unknown> : {} };
}

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
  const [testInput, setTestInput] = useState('{\n  "orderId": "DEMO-1001",\n  "customer": "Demo customer",\n  "total": 189,\n  "currency": "USD"\n}');
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [runLog, setRunLog] = useState<string[]>(['ready · save and activate, then execute the workflow']);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [past, setPast] = useState<Workflow[]>([]);
  const [future, setFuture] = useState<Workflow[]>([]);
  const drag = useRef<{ id: string; startX: number; startY: number; origin: [number, number] } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
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
  const preflightIssues = workflow.nodes.map(node => ({ node, issue: credentialRequirement(node) })).filter(item => item.issue);

  function checkpoint() { setPast(items => [...items.slice(-39), structuredClone(workflow)]); setFuture([]); }
  function undo() { const previous = past.at(-1); if (!previous) return; setFuture(items => [structuredClone(workflow), ...items].slice(0, 40)); setPast(items => items.slice(0, -1)); setWorkflow(previous); setSelectedId(null); setDirty(true); setMessage('Undid last change'); }
  function redo() { const next = future[0]; if (!next) return; setPast(items => [...items.slice(-39), structuredClone(workflow)]); setFuture(items => items.slice(1)); setWorkflow(next); setSelectedId(null); setDirty(true); setMessage('Redid change'); }

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
    checkpoint();
    const prior = selected || workflow.nodes.at(-1);
    const name = uniqueName(item.label, workflow.nodes);
    const node: WorkflowNode = { id: crypto.randomUUID(), name, type: item.type, typeVersion: item.version, disabled: false, position: prior ? [prior.position[0] + 300, prior.position[1]] : [80, 120], parameters: item.parameters };
    setWorkflow(old => ({ ...old, nodes: [...old.nodes, node], edges: prior ? [...old.edges, { from: prior.name, to: name, type: 'main', output: 0, input: 0 }] : old.edges }));
    setSelectedId(node.id); setDirty(true); setMessage('Unsaved changes'); setLibraryOpen(false);
  }
  function updateNode(change: Partial<WorkflowNode>) {
    if (!selected) return;
    checkpoint();
    const oldName = selected.name;
    setWorkflow(old => ({ ...old, nodes: old.nodes.map(node => node.id === selected.id ? { ...node, ...change } : node), edges: change.name ? old.edges.map(edge => ({ ...edge, from: edge.from === oldName ? change.name! : edge.from, to: edge.to === oldName ? change.name! : edge.to })) : old.edges }));
    setDirty(true); setMessage('Unsaved changes');
  }
  function removeNode() {
    if (!selected) return;
    checkpoint();
    setWorkflow(old => ({ ...old, nodes: old.nodes.filter(node => node.id !== selected.id), edges: old.edges.filter(edge => edge.from !== selected.name && edge.to !== selected.name) }));
    setSelectedId(null); setDirty(true); setMessage('Unsaved changes');
  }
  function connectTo(target: WorkflowNode) {
    const source = workflow.nodes.find(node => node.id === connectingFrom);
    if (!source || source.id === target.id) { setConnectingFrom(null); return; }
    if (!workflow.edges.some(edge => edge.from === source.name && edge.to === target.name)) {
      checkpoint();
      setWorkflow(old => ({ ...old, edges: [...old.edges, { from: source.name, to: target.name, type: 'main', output: 0, input: 0 }] }));
      setDirty(true); setMessage(`Connected ${source.name} to ${target.name}`);
    }
    setConnectingFrom(null);
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
  async function runWorkflow() {
    setConsoleOpen(true);
    const missingCredential = workflow.nodes.find(node => credentialRequirement(node));
    if (missingCredential) { setSelectedId(missingCredential.id); setError(`${missingCredential.name} needs a Google Gemini credential before this workflow can run.`); setRunLog(items => [`${new Date().toLocaleTimeString()} · blocked · missing Gemini credential`, ...items].slice(0, 8)); return; }
    if (!workflow.id || dirty) {
      const blockMessage = dirty ? 'save changes before running this workflow' : 'save this workflow before running it';
      setError(dirty ? 'Save your changes before running this workflow.' : 'Save this workflow before running it.');
      setRunLog(items => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · blocked · ${blockMessage}`, ...items].slice(0, 8));
      return;
    }
    setBusy('run'); setError('');
    setRunLog(items => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${hasWebhookTrigger ? workflow.active ? 'run started' : 'publishing webhook and starting run' : 'preparing dashboard runner and starting run'} · ${workflow.name}`, ...items].slice(0, 8));
    try {
      const input = JSON.parse(testInput);
      const result = await api<{ status: string; output: unknown }>(`?operation=trigger&workflowId=${encodeURIComponent(workflow.id)}`, { method: 'POST', body: JSON.stringify(input) });
      const output = typeof result.output === 'string' ? result.output : JSON.stringify(result.output);
      setRunLog(items => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · success · ${output?.slice(0, 140) || 'workflow completed'}`, ...items].slice(0, 8));
      const refreshed = await api<Workflow>(`?workflowId=${encodeURIComponent(workflow.id)}`);
      setWorkflow(refreshed); setMessage('Workflow execution completed'); await onChanged();
    }
    catch (issue) {
      const message = issue instanceof SyntaxError ? 'Test input must be valid JSON.' : issue instanceof Error ? issue.message : 'Could not trigger the workflow.';
      setRunLog(items => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · failed · ${message}`, ...items].slice(0, 8));
      setError(message);
    }
    finally { setBusy(''); }
  }
  const hasManualTrigger = workflow.nodes.some(node => node.type.endsWith('.manualTrigger'));
  const hasWebhookTrigger = workflow.nodes.some(node => node.type.endsWith('.webhook'));
  const dashboardRunnable = hasWebhookTrigger || hasManualTrigger;
  function duplicate() { checkpoint(); setWorkflow(old => ({ ...structuredClone(old), id: '', name: `${old.name} · copy`, active: false, updatedAt: null })); setDirty(true); setMessage('Copy ready · save to create it'); }
  function exportJson() { const blob = new Blob([JSON.stringify(draftOf(workflow), null, 2)], { type: 'application/json' }); const href = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = href; link.download = `${workflow.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'workflow'}.json`; link.click(); URL.revokeObjectURL(href); }
  async function importJson(file?: File) { if (!file) return; try { const next = importedWorkflow(JSON.parse(await file.text())); checkpoint(); setWorkflow(next); setSelectedId(null); setDirty(true); setMessage('Imported draft · review before saving'); requestAnimationFrame(() => fit(next.nodes, true)); } catch { setError('This file is not a valid n8n workflow JSON export.'); } finally { if (importRef.current) importRef.current.value = ''; } }
  return <main className={`studio-shell ${consoleOpen ? 'console-open' : 'console-closed'}`}>
    <header className="studio-topbar">
      <div className="studio-title-group"><button className="studio-icon-button" onClick={onClose} aria-label="Back to workspace"><ArrowLeft size={19} /></button><span className="studio-brand-mark" /><div><span className="studio-kicker">WORKFLOW STUDIO</span><Input className="studio-name" value={workflow.name} aria-label="Workflow name" onFocus={checkpoint} onChange={event => { setWorkflow(old => ({ ...old, name: event.target.value })); setDirty(true); setMessage('Unsaved changes'); }} /></div></div>
      <div className="studio-state"><div className="studio-file-actions"><button onClick={undo} disabled={!past.length} title="Undo"><Undo2 size={15} /></button><button onClick={redo} disabled={!future.length} title="Redo"><Redo2 size={15} /></button><button onClick={() => importRef.current?.click()} title="Import n8n JSON"><FileUp size={15} /></button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={event => void importJson(event.target.files?.[0])} /><button onClick={exportJson} title="Export n8n JSON"><Download size={15} /></button><button onClick={duplicate} title="Duplicate workflow"><Copy size={15} /></button></div><span className={`studio-sync ${error ? 'has-error' : dirty ? 'is-dirty' : ''}`}>{busy ? <LoaderCircle size={13} className="spin-icon" /> : error ? <X size={13} /> : dirty ? <span /> : <Check size={13} />}{error || message}</span><button className={`studio-status ${workflow.active ? 'is-active' : ''}`} onClick={() => void toggleActive()} disabled={!!busy}><span />{workflow.active ? 'Active' : 'Inactive'}</button><Button variant="outline" onClick={() => void save()} disabled={!!busy || !workflow.name.trim()}><Save size={15} />{busy === 'save' ? 'Saving…' : 'Save to n8n'}</Button></div>
    </header>
    {preflightIssues.length > 0 && <button className="studio-preflight" onClick={() => setSelectedId(preflightIssues[0].node.id)}><CircleAlert size={16} /><span><strong>{preflightIssues.length} setup {preflightIssues.length === 1 ? 'issue' : 'issues'}</strong> · {preflightIssues[0].node.name} needs {preflightIssues[0].issue}</span><ChevronRight size={15} /></button>}
    <section className={`studio-workspace ${libraryOpen ? 'has-library' : ''} ${selected || mode === 'ai' ? 'has-inspector' : ''}`}>
      {libraryOpen && <aside className="node-library is-open"><div className="library-head"><div><span className="studio-kicker">BUILD</span><h2>Add a step</h2></div><button onClick={() => setLibraryOpen(false)} aria-label="Close node library"><X size={17} /></button></div><div className="library-search"><Search size={15} /><Input placeholder="Search steps" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="library-list">{filtered.map(item => { const Icon = item.icon; return <button key={item.type} onClick={() => addNode(item)}><span><Icon size={18} /></span><div><strong>{item.label}</strong><small>{item.description}</small></div><Plus size={14} /></button>; })}</div><p className="library-note">This starter library uses native n8n nodes. Existing community and AI nodes remain visible and editable when loaded.</p></aside>}
      <div className={`studio-canvas ${connectingFrom ? 'is-connecting' : ''}`} onClick={() => setConnectingFrom(null)} onWheel={event => { event.preventDefault(); setScale(old => Math.max(.32, Math.min(1.5, old - event.deltaY * .0007))); }}>
        <div className="canvas-grid" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}>
          <svg className="studio-edges" width="4000" height="2600" aria-hidden="true">{workflow.edges.map((edge, index) => { const from = byName.get(edge.from), to = byName.get(edge.to); if (!from || !to) return null; const x1 = from.position[0] + 244, y1 = from.position[1] + 46, x2 = to.position[0], y2 = to.position[1] + 46, bend = Math.max(70, Math.abs(x2 - x1) * .45); return <g key={`${edge.from}-${edge.to}-${index}`}><path className="edge-halo" d={`M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`} /><path className="edge-line" d={`M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`} /></g>; })}</svg>
          {workflow.nodes.map((node, index) => { const Icon = iconFor(node.type), needsCredential = credentialRequirement(node); return <button key={node.id} className={`studio-node ${selectedId === node.id ? 'is-selected' : ''} ${connectingFrom === node.id ? 'is-connecting-from' : ''} ${node.disabled ? 'is-disabled' : ''} ${needsCredential ? 'has-warning' : ''}`} style={{ transform: `translate(${node.position[0]}px, ${node.position[1]}px)` }} onClick={event => { event.stopPropagation(); setSelectedId(node.id); }} onPointerDown={event => { if ((event.target as HTMLElement).closest('.node-drag')) { checkpoint(); drag.current = { id: node.id, startX: event.clientX, startY: event.clientY, origin: node.position }; } }}><span className="node-input" title="Connect into this step" onClick={event => { event.stopPropagation(); connectTo(node); }} /><span className="node-drag"><Grip size={13} /></span><span className="node-icon"><Icon size={23} strokeWidth={1.6} /></span><span className="node-copy"><small>{index === 0 ? 'TRIGGER / ENTRY' : cleanType(node.type).toUpperCase()}</small><strong>{node.name}</strong></span>{needsCredential && <span className="node-warning" title={needsCredential}><CircleAlert size={15} /></span>}<span className="node-output" title="Start a connection" onClick={event => { event.stopPropagation(); setConnectingFrom(node.id); setMessage(`Connect ${node.name} to another step`); }} /></button>; })}
          {!workflow.nodes.length && <button className="canvas-empty" onClick={() => setLibraryOpen(true)}><span><Plus size={22} /></span><strong>Start with a trigger</strong><small>Add your first n8n step</small></button>}
        </div>
        <div className="canvas-toolbar"><button onClick={() => setLibraryOpen(true)}><Plus size={17} /> Add step</button><span /><button onClick={() => setScale(old => Math.max(.32, old - .1))} aria-label="Zoom out"><ZoomOut size={17} /></button><button onClick={() => fit()}><MousePointer2 size={16} /> Fit</button><button onClick={() => setScale(old => Math.min(1.5, old + .1))} aria-label="Zoom in"><ZoomIn size={17} /></button><em>{Math.round(scale * 100)}%</em></div>
      </div>
      {(selected || mode === 'ai') && <aside className={`node-inspector ${mode === 'ai' ? 'ai-mode' : ''}`}>{mode === 'ai' ? <AiPanel onBuild={() => setMode('build')} /> : selected && <><div className="inspector-head"><div><span className="studio-kicker">STEP SETTINGS</span><h2>{selected.name}</h2></div><button onClick={() => setSelectedId(null)} aria-label="Close step settings"><X size={17} /></button></div><label className="inspector-field"><span>Name</span><Input value={selected.name} onFocus={checkpoint} onChange={event => updateNode({ name: event.target.value })} /></label><label className="inspector-field"><span>n8n node type</span><Input value={selected.type} disabled /></label><label className="inspector-check"><input type="checkbox" checked={selected.disabled} onChange={event => updateNode({ disabled: event.target.checked })} /><span>Disable this step</span></label><NodeFields node={selected} onChange={parameters => updateNode({ parameters })} />{selected.type.endsWith('.webhook') && <div className="webhook-test"><span>TEST INPUT · JSON</span><Textarea spellCheck={false} value={testInput} onChange={event => setTestInput(event.target.value)} /><Button variant="outline" disabled={dirty || !!busy} onClick={() => void runWorkflow()}><Play size={14} /> Execute webhook</Button><small>{dirty ? 'Save changes before testing.' : workflow.active ? 'This creates a real n8n execution.' : 'This will activate the workflow, then create a real n8n execution.'}</small></div>}<details className="advanced-json"><summary>Advanced parameters · JSON</summary><label className="inspector-field grow"><span>Complete node parameters <small>JSON</small></span><Textarea spellCheck={false} value={parametersText} onChange={event => setParametersText(event.target.value)} onBlur={applyParameters} /></label><Button variant="outline" onClick={applyParameters}>Apply JSON</Button></details><div className="connection-list"><span>CONNECTIONS</span>{workflow.edges.filter(edge => edge.from === selected.name || edge.to === selected.name).map((edge, index) => <div key={`${edge.from}-${edge.to}-${index}`}><small>{edge.from} → {edge.to}</small><button onClick={() => { checkpoint(); setWorkflow(old => ({ ...old, edges: old.edges.filter(item => item !== edge) })); setDirty(true); }}><X size={12} /></button></div>)}</div><div className="inspector-actions"><button className="delete-node" onClick={removeNode}><Trash2 size={15} /> Remove step</button></div></>}</aside>}
    </section>
    <nav className="studio-mode-dock"><button className={mode === 'build' ? 'active' : ''} onClick={() => setMode('build')}><Grip size={15} /> Build</button><button className={mode === 'ai' ? 'active' : ''} onClick={() => setMode('ai')}><MessageSquareText size={15} /> AI chat <span>OPTIONAL</span></button></nav>
    <button className="studio-execute-float" onClick={() => dashboardRunnable ? void runWorkflow() : instanceUrl && window.open(`${instanceUrl}/workflow/${encodeURIComponent(workflow.id)}`, '_blank', 'noopener,noreferrer')} disabled={!!busy || !workflow.id || (dashboardRunnable && dirty)} title={hasWebhookTrigger ? workflow.active ? 'Execute this workflow' : 'Activate this workflow and execute it' : hasManualTrigger ? 'Prepare the dashboard runner and execute this workflow' : 'Open this workflow in n8n'}><Play size={17} /><strong>{busy === 'run' ? 'Running workflow' : dashboardRunnable ? 'Execute workflow' : 'Open in n8n'}</strong></button>
    <footer className="studio-footer studio-terminal-footer"><div className="studio-terminal-head"><button className="studio-console-toggle" onClick={() => setConsoleOpen(value => !value)} aria-expanded={consoleOpen}><TerminalSquare size={15} /><span>Run console</span>{consoleOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button><span>{workflow.nodes.length} steps</span><span>{workflow.edges.length} connections</span>{workflow.id && instanceUrl && <a href={`${instanceUrl}/workflow/${encodeURIComponent(workflow.id)}`} target="_blank" rel="noreferrer">Open in n8n <ChevronRight size={13} /></a>}</div>{consoleOpen && <div className="studio-terminal-log">{runLog.map((line, index) => <code key={`${line}-${index}`}>{line}</code>)}</div>}</footer>
  </main>;
}

function AiPanel({ onBuild }: { onBuild: () => void }) {
  return <div className="ai-panel"><div className="inspector-head"><div><span className="studio-kicker">OPTIONAL MODE</span><h2>AI workflow chat</h2></div><Bot size={20} /></div><div className="ai-orb"><Bot size={25} /></div><h3>Bring your own n8n builder</h3><p>The public n8n API does not expose n8n’s built-in AI assistant. To keep this honest and reliable, chat connects to a dedicated AI-builder workflow in your n8n account instead of pretending a local rule engine is AI.</p><div className="ai-setup"><span>SETUP REQUIRED</span><strong>AI builder webhook</strong><small>Create or import the builder workflow, then connect its webhook here.</small></div><Button variant="outline" disabled>Connect builder webhook</Button><button className="text-action" onClick={onBuild}>Continue building manually</button></div>;
}

function NodeFields({ node, onChange }: { node: WorkflowNode; onChange: (parameters: Record<string, unknown>) => void }) {
  const parameters = node.parameters || {};
  const update = (key: string, value: unknown) => onChange({ ...parameters, [key]: value });
  if (node.type.endsWith('.webhook')) return <div className="structured-fields"><span className="structured-title">WEBHOOK</span><label><span>Method</span><select value={typeof parameters.httpMethod === 'string' ? parameters.httpMethod : 'GET'} onChange={event => update('httpMethod', event.target.value)}><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></label><label><span>Path</span><Input value={typeof parameters.path === 'string' ? parameters.path : ''} onChange={event => update('path', event.target.value)} /></label></div>;
  if (node.type.endsWith('.httpRequest')) return <div className="structured-fields"><span className="structured-title">HTTP REQUEST</span><label><span>Method</span><select value={typeof parameters.method === 'string' ? parameters.method : 'GET'} onChange={event => update('method', event.target.value)}><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></label><label><span>URL</span><Input placeholder="https://api.example.com" value={typeof parameters.url === 'string' ? parameters.url : ''} onChange={event => update('url', event.target.value)} /></label></div>;
  if (node.type.endsWith('.code')) return <div className="structured-fields"><span className="structured-title">JAVASCRIPT</span><label><span>Code</span><Textarea className="code-field" spellCheck={false} value={typeof parameters.jsCode === 'string' ? parameters.jsCode : ''} onChange={event => update('jsCode', event.target.value)} /></label></div>;
  if (node.type.endsWith('.scheduleTrigger')) { const rule = parameters.rule && typeof parameters.rule === 'object' ? parameters.rule as Record<string, unknown> : {}; const intervals = Array.isArray(rule.interval) ? rule.interval : []; const first = intervals[0] && typeof intervals[0] === 'object' ? intervals[0] as Record<string, unknown> : {}; return <div className="structured-fields"><span className="structured-title">SCHEDULE</span><label><span>Every</span><select value={typeof first.field === 'string' ? first.field : 'hours'} onChange={event => update('rule', { interval: [{ field: event.target.value, [`${event.target.value}Interval`]: 1 }] })}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></label><label><span>Interval</span><Input type="number" min="1" value={Number(first.minutesInterval || first.hoursInterval || first.daysInterval) || 1} onChange={event => update('rule', { interval: [{ ...first, [`${typeof first.field === 'string' ? first.field : 'hours'}Interval`]: Number(event.target.value) || 1 }] })} /></label></div>; }
  return <div className="structured-fields compact"><span className="structured-title">CONFIGURATION</span><p>This node keeps its native n8n parameters. Use the advanced editor for fields that depend on installed credentials or community packages.</p></div>;
}
