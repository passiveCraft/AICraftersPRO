'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowLeft, ArrowUpRight, Box, Check, ChevronDown, ChevronRight, ChevronUp, Clock3, Code2, Eye, EyeOff, GitBranch, Globe2, Layers3, LayoutGrid, Maximize2, Minus, Network, PanelRightClose, PanelRightOpen, Plus, Search, Sparkles, TerminalSquare, Webhook } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ThreeOfficeScene } from '@/components/three-office-scene';
import type { Execution, Workflow, WorkflowNode } from '@/lib/n8n-types';

type Props = {
  workflows: Workflow[]; executions: Execution[]; connected: boolean; light: boolean;
  onWorkflow: (workflow: Workflow) => void; onWorkflows: () => void;
  onCreate: () => void; onActivity: () => void; onCreations: () => void; onConnect: () => void; onChanged: () => Promise<void> | void;
};

function nodeIcon(type: string) {
  if (/webhook/i.test(type)) return Webhook;
  if (/http/i.test(type)) return Globe2;
  if (/code/i.test(type)) return Code2;
  if (/schedule|trigger/i.test(type)) return Clock3;
  if (/if|switch/i.test(type)) return GitBranch;
  return Box;
}
function nodeKind(type: string) { return type.split('.').at(-1)?.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Step'; }
function latest(runs: Execution[], id: string) { return runs.filter(run => run.workflowId === id).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))[0]; }
function stamp(date: string | null) { return date ? new Date(date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No runs yet'; }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const requestHeaders = new Headers(init?.headers); requestHeaders.set('Content-Type', 'application/json');
  const response = await fetch(`/api/n8n${path}`, { ...init, credentials: 'same-origin', cache: 'no-store', headers: requestHeaders });
  const body: unknown = await response.json().catch(() => ({}));
  const errorBody = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof errorBody.error === 'string' ? errorBody.error : 'n8n could not complete this run.');
  return body as T;
}

export function OfficeOverview({ workflows, executions, connected, light, onWorkflow, onWorkflows, onCreate, onActivity, onCreations, onConnect, onChanged }: Props) {
  const [sidebar, setSidebar] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ workflowId: string; nodeId?: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [resetViewKey, setResetViewKey] = useState(0);
  const [labelsVisible, setLabelsVisible] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'floor' | 'islands'>('floor');
  const [runBusy, setRunBusy] = useState(false);
  const [runningWorkflowId, setRunningWorkflowId] = useState<string>();
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [runLog, setRunLog] = useState<string[]>(['ready · select a workflow, then run it from this workspace']);
  useEffect(() => {
    setSidebar(localStorage.getItem('operator-sidebar') !== 'hidden');
    if (localStorage.getItem('operator-layout-v2') === 'islands') setLayoutMode('islands');
  }, []);
  function toggleSidebar() { setSidebar(value => { localStorage.setItem('operator-sidebar', value ? 'hidden' : 'visible'); return !value; }); }
  function toggleLayout() { setLayoutMode(value => { const next = value === 'floor' ? 'islands' : 'floor'; localStorage.setItem('operator-layout-v2', next); return next; }); }
  const activeFlow = workflows.find(workflow => workflow.id === selected?.workflowId);
  const activeNode = activeFlow?.nodes.find(node => node.id === selected?.nodeId);
  const filtered = workflows.filter(workflow => workflow.name.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'active' ? workflow.active : !workflow.active)));
  const running = executions.filter(run => run.status === 'running' || run.status === 'new');
  function inspect(workflow: Workflow, node?: WorkflowNode) { setSelected({ workflowId: workflow.id, nodeId: node?.id }); setSidebar(true); }
  const runnableFlow = activeFlow || workflows.find(workflow => workflow.active) || workflows[0];
  async function runWorkflow(workflow = runnableFlow) {
    setConsoleOpen(true);
    if (!workflow) { setRunLog(items => [`${stamp(new Date().toISOString())} · no workflow selected`, ...items].slice(0, 8)); return; }
    if (!workflow.active) { setRunLog(items => [`${stamp(new Date().toISOString())} · ${workflow.name} is inactive`, ...items].slice(0, 8)); return; }
    const hasWebhook = workflow.nodes.some(node => node.type.endsWith('.webhook') && !node.disabled);
    if (!hasWebhook) { setRunLog(items => [`${stamp(new Date().toISOString())} · ${workflow.name} has no active webhook trigger`, ...items].slice(0, 8)); return; }
    const started = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setRunBusy(true); setRunningWorkflowId(workflow.id);
    setRunLog(items => [`${started} · run started · ${workflow.name}`, ...items].slice(0, 8));
    try {
      const output = await api<{ status: string; output: unknown }>(`?operation=trigger&workflowId=${encodeURIComponent(workflow.id)}`, { method: 'POST', body: JSON.stringify({ source: 'operator-core-workspace', sample: true, ts: new Date().toISOString() }) });
      const done = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const summary = typeof output.output === 'string' ? output.output : JSON.stringify(output.output);
      setRunLog(items => [`${done} · success · ${summary?.slice(0, 140) || 'workflow completed'}`, ...items].slice(0, 8));
      await onChanged();
    } catch (issue) {
      const done = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const message = issue instanceof Error ? issue.message : 'Workflow run failed.';
      setRunLog(items => [`${done} · failed · ${message}`, ...items].slice(0, 8));
    } finally {
      setRunBusy(false); setRunningWorkflowId(undefined);
    }
  }

  return <div className={`office-layout ${sidebar ? '' : 'sidebar-hidden'}`}>
    <section className={`office-map ${consoleOpen ? 'console-open' : ''}`} aria-label="Workflow workspace">
      <div className="workspace-toolbar controls-only">
        <div className="workspace-toolbar-actions"><button onClick={onCreate}><Plus size={17} /> New workflow</button><button className="gemini-toolbar" onClick={onCreations}><Sparkles size={16} /> Gemini studio</button><button className={`label-toggle ${labelsVisible ? 'is-active' : ''}`} onClick={() => setLabelsVisible(value => !value)} aria-label={labelsVisible ? 'Hide workspace labels' : 'Show workspace labels'} title={labelsVisible ? 'Hide labels' : 'Show labels'}>{labelsVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button><button className={`layout-toggle ${layoutMode === 'islands' ? 'is-active' : ''}`} onClick={toggleLayout} aria-pressed={layoutMode === 'islands'} aria-label={layoutMode === 'floor' ? 'Switch to node islands' : 'Switch to team floor'} title={layoutMode === 'floor' ? 'Node islands view' : 'Team floor view'}>{layoutMode === 'floor' ? <Layers3 size={18} /> : <LayoutGrid size={18} />}</button><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebar ? 'Hide sidebar' : 'Show sidebar'}>{sidebar ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}</button></div>
      </div>
      <div className="workspace-stage">
        {workflows.length ? <ThreeOfficeScene workflows={workflows} executions={executions} light={light} zoom={zoom} resetViewKey={resetViewKey} labelsVisible={labelsVisible} layoutMode={layoutMode} runningWorkflowId={runningWorkflowId} selectedWorkflowId={activeFlow?.id} selectedNodeId={activeNode?.id} onZoomChange={value => setZoom(Number(value.toFixed(3)))} onInspect={inspect} /> : <div className="empty-office"><span><Network size={36} strokeWidth={1.3} /></span><h2>{connected ? 'Your office is ready' : 'Your workflows belong here'}</h2><p>{connected ? 'Create your first workflow or import an existing n8n workflow in the editor.' : 'Start n8n and connect it to bring every workflow into this workspace.'}</p><button onClick={connected ? onCreate : onConnect}>{connected ? <Plus size={17} /> : <Network size={17} />}{connected ? 'Create workflow' : 'Connect n8n'}</button></div>}
      </div>
      <div className={`workspace-runbar ${consoleOpen ? 'is-open' : ''}`}><button className="runbar-console-toggle" onClick={() => setConsoleOpen(value => !value)} aria-expanded={consoleOpen}><TerminalSquare size={16} /><span>Run console</span><small>{consoleOpen ? `${runLog.length} log entries` : runLog[0]}</small>{consoleOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>{consoleOpen && <div className="run-terminal" aria-label="Workflow run log">{runLog.map((line, index) => <code key={`${line}-${index}`}>{line}</code>)}</div>}</div>
      <button className={`workspace-execute ${consoleOpen ? 'console-open' : ''}`} disabled={!connected || runBusy || !runnableFlow} onClick={() => void runWorkflow()}><Activity size={18} /><strong>{runBusy ? 'Running workflow' : 'Execute workflow'}</strong></button>
      <div className="workspace-bottom"><span><i />{connected ? running.length ? `${running.length} running` : 'Ready to execute workflow' : 'n8n is offline'}<small>{layoutMode === 'islands' ? 'Drag an island to arrange · drag empty space to move' : 'Drag to move'} · wheel, trackpad or pinch to zoom</small></span><div className="office-zoom-controls"><button title="Zoom in" aria-label="Zoom in workspace" onClick={() => setZoom(value => Math.min(3.2, Number((value + .2).toFixed(2))))}><Plus size={20} /></button><button title="Zoom out" aria-label="Zoom out workspace" onClick={() => setZoom(value => Math.max(.55, Number((value - .16).toFixed(2))))}><Minus size={20} /></button><button title="Reset view" aria-label="Reset workspace position and zoom" onClick={() => { setZoom(1); setResetViewKey(value => value + 1); }}><Maximize2 size={17} /></button><span>{Math.round(zoom * 100)}%</span></div></div>
    </section>

    {sidebar && <aside className="task-rail" aria-label="Workspace details">
      <header className="rail-heading"><div><span className="workspace-overline">{activeFlow ? activeNode ? 'STEP DETAILS' : 'WORKFLOW DETAILS' : 'TASK STATUS'}</span><h2>{activeFlow ? activeNode ? 'Inside the step' : activeFlow.name : 'Whole office'}</h2></div><button aria-label="Hide sidebar" onClick={toggleSidebar}><PanelRightClose size={19} /></button></header>
      {activeFlow ? <div className="workspace-inspector">
        <button className="inspector-back" onClick={() => activeNode ? setSelected({ workflowId: activeFlow.id }) : setSelected(null)}><ArrowLeft size={15} />{activeNode ? 'Workflow details' : 'Whole office'}</button>
        <div className="inspector-identity"><span>{activeNode ? (() => { const Icon = nodeIcon(activeNode.type); return <Icon size={27} />; })() : <Network size={27} />}</span><h3>{activeNode?.name || activeFlow.name}</h3><p>{activeNode ? nodeKind(activeNode.type) : activeFlow.active ? 'Active · waiting for its trigger' : 'Inactive workflow'}</p></div>
        <dl className="workspace-facts">{activeNode ? <><div><dt>State</dt><dd>{activeNode.disabled ? 'Disabled' : 'Enabled'}</dd></div><div><dt>Node version</dt><dd>{activeNode.typeVersion}</dd></div><div><dt>Node type</dt><dd>{activeNode.type}</dd></div></> : <><div><dt>Steps</dt><dd>{activeFlow.nodes.length}</dd></div><div><dt>Connections</dt><dd>{activeFlow.edges.length}</dd></div><div><dt>Last updated</dt><dd>{stamp(activeFlow.updatedAt)}</dd></div><div><dt>Tags</dt><dd>{activeFlow.tags.join(', ') || 'No tags'}</dd></div></>}</dl>
        {activeNode ? <><h4>Connections</h4><div className="detail-connections">{activeFlow.edges.filter(edge => edge.from === activeNode.name || edge.to === activeNode.name).map((edge, index) => <div key={index}><GitBranch size={15} /><span>{edge.from}<ChevronRight size={13} />{edge.to}</span><small>{edge.type} · output {edge.output || 0}</small></div>)}</div><details className="detail-parameters"><summary>View parameters</summary><pre>{JSON.stringify(activeNode.parameters, null, 2)}</pre></details></> : <><h4>Steps in this workflow</h4><div className="detail-steps">{activeFlow.nodes.map(node => { const Icon = nodeIcon(node.type); return <button key={node.id} onClick={() => inspect(activeFlow, node)}><Icon size={17} /><span>{node.name}<small>{nodeKind(node.type)}</small></span><ChevronRight size={15} /></button>; })}</div><h4>Recent activity</h4><div className="detail-runs">{executions.filter(run => run.workflowId === activeFlow.id).slice(0, 5).map(run => <div key={run.id}><span className={run.status === 'success' ? 'success' : ''}>{run.status === 'success' ? <Check size={15} /> : <Clock3 size={15} />}{run.status}</span><small>{stamp(run.startedAt)}</small></div>)}{!executions.some(run => run.workflowId === activeFlow.id) && <p>No executions recorded.</p>}</div></>}
        <div className="inspector-actions-row"><button onClick={() => void runWorkflow(activeFlow)} disabled={runBusy || !activeFlow.active}><Activity size={16} /> Execute here</button><button className="inspector-open" onClick={() => onWorkflow(activeFlow)}>Open editor <ArrowUpRight size={17} /></button></div>
      </div> : <>
        <div className="rail-summary"><div><strong>{workflows.length}</strong><span>Workflows</span></div><div><strong>{workflows.filter(workflow => workflow.active).length}</strong><span>Active</span></div><div><strong>{executions.length}</strong><span>Recent runs</span></div></div>
        <div className="task-filters">{['all', 'active', 'inactive'].map(value => <button key={value} onClick={() => setFilter(value)} className={filter === value ? 'active' : ''}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
        <div className="task-search"><Search size={17} /><Input aria-label="Search workflows" placeholder="Search workflows…" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="office-task-list">{filtered.map(workflow => { const run = latest(executions, workflow.id); return <button key={workflow.id} onClick={() => inspect(workflow)}><span className="task-workflow-icon"><Network size={19} /></span><div><strong>{workflow.name}</strong><small>{workflow.nodes.length} steps · {workflow.active ? 'Active' : 'Inactive'}</small><span className="task-run-state">{run ? `Last run · ${run.status}` : 'No runs yet'}</span></div><ChevronRight size={16} /></button>; })}{!filtered.length && <p className="rail-empty">{connected ? 'No workflows match this view.' : 'Start n8n to restore your workflows.'}</p>}</div>
        <button className="rail-library" onClick={onWorkflows}>Browse workflow library <ArrowUpRight size={16} /></button>
      </>}
      <footer className="rail-health"><button onClick={onConnect}><i className={connected ? 'connected' : ''} />{connected ? 'n8n connected' : 'Connect n8n'}</button><button onClick={onActivity}><Activity size={16} /> Activity</button></footer>
    </aside>}
  </div>;
}
