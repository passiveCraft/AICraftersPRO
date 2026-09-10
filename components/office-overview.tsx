'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowLeft, ArrowUpRight, Box, Check, ChevronRight, Clock3, Code2, GitBranch, Globe2, Maximize2, Network, PanelRightClose, PanelRightOpen, Plus, Search, Webhook, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Execution, Workflow, WorkflowNode } from '@/lib/n8n-types';

type Props = { workflows: Workflow[]; executions: Execution[]; connected: boolean; paused: boolean; loading?: boolean; error?: string; onWorkflow: (workflow: Workflow) => void; onWorkflows: () => void; onCreate: () => void; onActivity: () => void; onConnect: () => void };
const accents = ['#69b4b1', '#b08bba', '#d6aa6b', '#7b9bd2', '#cd9299', '#8fa981'];
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

export function OfficeOverview({ workflows, executions, connected, paused, loading, error, onWorkflow, onWorkflows, onCreate, onActivity, onConnect }: Props) {
  const [sidebar, setSidebar] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ workflowId: string; nodeId?: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => { setSidebar(localStorage.getItem('operator-sidebar') !== 'hidden'); }, []);
  function toggleSidebar() { setSidebar(value => { localStorage.setItem('operator-sidebar', value ? 'hidden' : 'visible'); return !value; }); }
  const activeFlow = workflows.find(workflow => workflow.id === selected?.workflowId);
  const activeNode = activeFlow?.nodes.find(node => node.id === selected?.nodeId);
  const filtered = workflows.filter(workflow => workflow.name.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || (filter === 'active' ? workflow.active : !workflow.active)));
  const running = executions.filter(run => run.status === 'running' || run.status === 'new');
  function inspect(workflow: Workflow, node?: WorkflowNode) { setSelected({ workflowId: workflow.id, nodeId: node?.id }); setSidebar(true); }
  return <div className={`office-layout ${sidebar ? '' : 'sidebar-hidden'} ${paused ? 'motion-paused' : ''}`}>
    <section className="office-map" aria-label="Workflow workspace">
      <div className="workspace-toolbar"><div><span className="workspace-overline">Your workspace</span><h1>Operations office <span>{workflows.length}</span></h1></div><div className="workspace-toolbar-actions"><button onClick={onCreate}><Plus size={17} /> New workflow</button><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebar ? 'Hide sidebar' : 'Show sidebar'} aria-expanded={sidebar}>{sidebar ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}</button></div></div>
      {(!connected || error) && <div className="workspace-connection"><span className="connection-symbol"><Network size={20} /></span><div><strong>{loading ? 'Connecting to your workspace…' : error ? 'Connection needs attention' : 'Connect your n8n workspace'}</strong><p>{error || 'Your workflows, steps and execution history will appear here.'}</p></div><button onClick={onConnect}>Connection settings <ArrowUpRight size={16} /></button></div>}
      <div className="workspace-scroll">
        <div className={`office-world ${workflows.length === 1 ? 'single-workflow' : ''}`} style={{ zoom }}>
          <button className="workspace-brain" onClick={() => { setSelected(null); setSidebar(true); }}><span className="brain-graphic" aria-hidden="true"><Network size={29} /><i /><i /></span><span><strong>Workspace brain</strong><small>{workflows.length} workflows · {workflows.reduce((sum, workflow) => sum + workflow.nodes.length, 0)} steps</small></span><span className="brain-state"><i />{connected ? running.length ? `${running.length} running` : 'Connected' : 'Offline'}</span></button>
          <div className="office-pods">
            {workflows.map((workflow, index) => {
              const run = latest(executions, workflow.id); const busy = running.some(item => item.workflowId === workflow.id);
              return <article className={`workflow-pod ${activeFlow?.id === workflow.id ? 'selected' : ''} ${busy ? 'pod-running' : ''}`} key={workflow.id} style={{ '--pod-accent': accents[index % accents.length] } as React.CSSProperties}>
                <div className="pod-wire" aria-hidden="true" />
                <header className="pod-header"><button onClick={() => inspect(workflow)}><span className="pod-dot" /><span><small>{workflow.tags.join(' · ') || 'n8n workflow'}</small><h2>{workflow.name}</h2></span><ChevronRight size={18} /></button><span className={`workflow-state ${workflow.active ? 'enabled' : ''}`}><i />{busy ? 'Running' : workflow.active ? 'Active' : 'Inactive'}</span></header>
                <div className="pod-metrics"><div><strong>{workflow.nodes.length}</strong><span>Steps</span></div><div><strong>{workflow.edges.length}</strong><span>Connections</span></div><div><strong>{executions.filter(item => item.workflowId === workflow.id).length}</strong><span>Recent runs</span></div></div>
                <div className="pod-platform"><div className="pod-steps">{workflow.nodes.map((node, position) => { const Icon = nodeIcon(node.type); return <button className={`office-step ${node.disabled ? 'step-disabled' : ''} ${activeNode?.id === node.id && activeFlow?.id === workflow.id ? 'step-selected' : ''}`} key={node.id} onClick={() => inspect(workflow, node)} aria-label={`Inspect ${node.name}`}><span className="step-station"><Icon size={24} strokeWidth={1.6} /><i /></span><span className="step-name">{node.name}</span><span className="step-role">{node.disabled ? 'Disabled' : nodeKind(node.type)}</span><b>{String(position + 1).padStart(2, '0')}</b></button>; })}{!workflow.nodes.length && <button className="empty-pod-step" onClick={() => onWorkflow(workflow)}><Plus size={24} /><span>Add the first step</span></button>}</div></div>
                <footer className="pod-footer"><span><i className={run?.status === 'success' ? 'run-success' : ''} />{run ? `Last run: ${run.status}` : 'No executions yet'}</span><button onClick={() => onWorkflow(workflow)}>Open editor <ArrowUpRight size={16} /></button></footer>
              </article>;
            })}
            {!workflows.length && <div className="empty-office"><span><Network size={36} strokeWidth={1.3} /></span><h2>{connected ? 'Your office is ready' : 'Your workflows belong here'}</h2><p>{connected ? 'Create your first workflow or import an existing n8n workflow in the editor.' : 'Connect n8n to bring each workflow and its steps into this workspace.'}</p><button onClick={connected ? onCreate : onConnect}>{connected ? <Plus size={17} /> : <Network size={17} />}{connected ? 'Create workflow' : 'Connect n8n'}</button></div>}
          </div>
        </div>
      </div>
      <div className="workspace-bottom"><span><i />{connected ? 'Live workflow data' : 'No connection'}<small>n8n stores your workflows</small></span><div><button aria-label="Zoom out workspace" onClick={() => setZoom(value => Math.max(.65, value - .1))}><ZoomOut size={17} /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in workspace" onClick={() => setZoom(value => Math.min(1.35, value + .1))}><ZoomIn size={17} /></button><button aria-label="Reset workspace zoom" onClick={() => setZoom(1)}><Maximize2 size={17} /></button></div></div>
    </section>
    {sidebar && <aside className="task-rail" aria-label="Workspace details">
      <header className="rail-heading"><div><span className="workspace-overline">{activeFlow ? activeNode ? 'Step details' : 'Workflow details' : 'Workspace'}</span><h2>{activeFlow ? activeNode ? 'Inside the step' : 'Inside the workflow' : 'Work & activity'}</h2></div><button aria-label="Hide sidebar" onClick={toggleSidebar}><PanelRightClose size={19} /></button></header>
      {activeFlow ? <div className="workspace-inspector"><button className="inspector-back" onClick={() => activeNode ? setSelected({ workflowId: activeFlow.id }) : setSelected(null)}><ArrowLeft size={15} />{activeNode ? 'Workflow details' : 'All workflows'}</button><div className="inspector-identity"><span>{activeNode ? (() => { const Icon = nodeIcon(activeNode.type); return <Icon size={27} />; })() : <Network size={27} />}</span><h3>{activeNode?.name || activeFlow.name}</h3><p>{activeNode ? nodeKind(activeNode.type) : activeFlow.active ? 'Active · waiting for its trigger' : 'Inactive workflow'}</p></div>
        <dl className="workspace-facts">{activeNode ? <><div><dt>State</dt><dd>{activeNode.disabled ? 'Disabled' : 'Enabled'}</dd></div><div><dt>Node version</dt><dd>{activeNode.typeVersion}</dd></div><div><dt>Node type</dt><dd>{activeNode.type}</dd></div></> : <><div><dt>Steps</dt><dd>{activeFlow.nodes.length}</dd></div><div><dt>Connections</dt><dd>{activeFlow.edges.length}</dd></div><div><dt>Last updated</dt><dd>{stamp(activeFlow.updatedAt)}</dd></div><div><dt>Tags</dt><dd>{activeFlow.tags.join(', ') || 'No tags'}</dd></div></>}</dl>
        {activeNode ? <><h4>Connections</h4><div className="detail-connections">{activeFlow.edges.filter(edge => edge.from === activeNode.name || edge.to === activeNode.name).map((edge, index) => <div key={index}><GitBranch size={15} /><span>{edge.from}<ChevronRight size={13} />{edge.to}</span><small>{edge.type} · output {edge.output || 0}</small></div>)}</div><details className="detail-parameters"><summary>View parameters</summary><pre>{JSON.stringify(activeNode.parameters, null, 2)}</pre></details></> : <><h4>Steps in this workflow</h4><div className="detail-steps">{activeFlow.nodes.map(node => { const Icon = nodeIcon(node.type); return <button key={node.id} onClick={() => inspect(activeFlow, node)}><Icon size={17} /><span>{node.name}<small>{nodeKind(node.type)}</small></span><ChevronRight size={15} /></button>; })}</div><h4>Recent activity</h4><div className="detail-runs">{executions.filter(run => run.workflowId === activeFlow.id).slice(0, 5).map(run => <div key={run.id}><span className={run.status === 'success' ? 'success' : ''}>{run.status === 'success' ? <Check size={15} /> : <Clock3 size={15} />}{run.status}</span><small>{stamp(run.startedAt)}</small></div>)}{!executions.some(run => run.workflowId === activeFlow.id) && <p>No executions recorded.</p>}</div></>}
        <button className="inspector-open" onClick={() => onWorkflow(activeFlow)}>Open full workflow editor <ArrowUpRight size={17} /></button></div> : <>
        <div className="rail-summary"><div><strong>{workflows.length}</strong><span>Workflows</span></div><div><strong>{workflows.filter(workflow => workflow.active).length}</strong><span>Active</span></div><div><strong>{executions.length}</strong><span>Recent runs</span></div></div>
        <div className="task-filters">{['all', 'active', 'inactive'].map(value => <button key={value} onClick={() => setFilter(value)} className={filter === value ? 'active' : ''}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div><div className="task-search"><Search size={17} /><Input aria-label="Search workflows" placeholder="Search workflows…" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="office-task-list">{filtered.map(workflow => { const run = latest(executions, workflow.id); return <button key={workflow.id} onClick={() => inspect(workflow)}><span className="task-workflow-icon"><Network size={19} /></span><div><strong>{workflow.name}</strong><small>{workflow.nodes.length} steps · {workflow.active ? 'Active' : 'Inactive'}</small><span className="task-run-state">{run ? `Last run · ${run.status}` : 'No runs yet'}</span></div><ChevronRight size={16} /></button>; })}{!filtered.length && <p className="rail-empty">{connected ? 'No workflows match this view.' : 'Connect your n8n account to see workflows.'}</p>}</div><button className="rail-library" onClick={onWorkflows}>Browse workflow library <ArrowUpRight size={16} /></button></>}
      <footer className="rail-health"><button onClick={onConnect}><i className={connected ? 'connected' : ''} />{connected ? 'n8n connected' : 'Connect n8n'}</button><button onClick={onActivity}><Activity size={16} /> Activity</button></footer>
    </aside>}
  </div>;
}
