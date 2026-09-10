'use client';

import { useMemo, useState } from 'react';
import { Activity, ArrowUpRight, CheckCircle2, CircleDashed, Network, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Execution, Workflow } from '@/lib/n8n-types';

type Props = { workflows: Workflow[]; executions: Execution[]; connected: boolean; paused: boolean; onWorkflow: (workflow: Workflow) => void; onWorkflows: () => void; onCreate: () => void; onActivity: () => void };
const departments = [
  { id: 'market', name: 'MARKET INTELLIGENCE', x: 22, y: 18, tone: 'cyan', agents: 6 },
  { id: 'creative', name: 'CREATIVE STUDIO', x: 53, y: 12, tone: 'rose', agents: 7 },
  { id: 'commerce', name: 'COMMERCE OPS', x: 33, y: 49, tone: 'amber', agents: 5 },
  { id: 'cx', name: 'CUSTOMER EXPERIENCE', x: 69, y: 44, tone: 'violet', agents: 6 },
  { id: 'growth', name: 'GROWTH & RETENTION', x: 51, y: 72, tone: 'blue', agents: 4 },
];
function hash(value: string) { return [...value].reduce((total, char) => total + char.charCodeAt(0), 0); }

export function OfficeOverview({ workflows, executions, connected, paused, onWorkflow, onWorkflows, onCreate, onActivity }: Props) {
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [search, setSearch] = useState('');
  const assigned = useMemo(() => departments.map((department, index) => ({ ...department, workflows: workflows.filter(item => hash(item.id) % departments.length === index) })), [workflows]);
  const filtered = workflows.filter(item => (taskFilter === 'all' || (taskFilter === 'active' ? item.active : !item.active)) && item.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className={`office-layout ${paused ? 'motion-paused' : ''}`}>
    <section className="office-map" aria-label="AI operations office">
      <div className="office-atmosphere" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <svg className="office-data-lines" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="flow-a"><stop stopColor="#52dbed" /><stop offset=".5" stopColor="#e077a6" /><stop offset="1" stopColor="#9d80ec" /></linearGradient><filter id="flow-glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M205 168 C390 175 420 300 504 374 S690 254 760 155" /><path d="M205 168 C260 350 310 440 389 503 S496 610 520 663" /><path d="M760 155 C720 310 710 390 744 468 S650 630 520 663" /><path d="M389 503 C480 450 580 430 744 468" /><path className="live-path" d="M205 168 C390 175 420 300 504 374 S690 254 760 155" /></svg>
      <div className="office-brain"><span className="brain-ring"><Sparkles size={18} /></span><div><strong>THE BRAIN</strong><small>{workflows.length} workflow{workflows.length === 1 ? '' : 's'} · {executions.length} recent runs</small></div></div>
      {assigned.map((department) => { const lead = department.workflows[0]; const active = department.workflows.filter(item => item.active).length; return <button key={department.id} className={`department-zone tone-${department.tone}`} style={{ left: `${department.x}%`, top: `${department.y}%` }} onClick={() => lead ? onWorkflow(lead) : onWorkflows()}><div className="department-card"><span>{department.name}</span><strong>{department.workflows.length || department.agents}</strong><small>{department.workflows.length ? 'WORKFLOWS' : 'STATIONS'}</small><dl><div><dt>ACTIVE</dt><dd>{active}</dd></div><div><dt>RUNS</dt><dd>{executions.filter(run => department.workflows.some(flow => flow.id === run.workflowId)).length}</dd></div></dl></div><div className="iso-platform"><span className="platform-top" /><span className="platform-front" /><span className="platform-side" /><div className="agent-cluster">{Array.from({ length: Math.min(7, Math.max(3, department.workflows.length || department.agents)) }, (_, agent) => <span key={agent} className={agent === 0 && active > 0 ? 'agent-live' : ''}><i /><b /></span>)}</div>{lead && <span className="zone-workflow">{lead.name}</span>}</div></button>; })}
      <div className="map-controls"><button onClick={onCreate}><Plus size={17} /> New workflow</button><button onClick={onWorkflows}><Network size={16} /> All workflows</button></div>
      <div className="office-legend"><span><i className="legend-live" />Running</span><span><i />Ready</span><span>Work moves through n8n</span></div>
    </section>
    <aside className="task-rail">
      <div className="task-compose"><div><span className="task-team-dot" /> WORKFLOWS</div><button onClick={onCreate}><Plus size={14} /> NEW</button></div>
      <div className="brain-summary"><span className="brain-mini"><Sparkles size={17} /></span><div><strong>THE BRAIN</strong><small>{connected ? 'Connected to n8n · live structure' : 'Waiting for an n8n connection'}</small></div><button onClick={onWorkflows}><ArrowUpRight size={15} /></button></div>
      <div className="task-title"><div><h2>WORK STATUS</h2><span>LIVE</span></div><button onClick={onActivity}><Activity size={15} /> RUNS</button></div>
      <div className="task-filters"><button className={taskFilter === 'all' ? 'active' : ''} onClick={() => setTaskFilter('all')}>ALL {workflows.length}</button><button className={taskFilter === 'active' ? 'active' : ''} onClick={() => setTaskFilter('active')}>ACTIVE {workflows.filter(item => item.active).length}</button><button className={taskFilter === 'paused' ? 'active' : ''} onClick={() => setTaskFilter('paused')}>PAUSED {workflows.filter(item => !item.active).length}</button></div>
      <div className="task-search"><Search size={14} /><Input aria-label="Search workflows" placeholder="Find a workflow" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div className="office-task-list">{filtered.map(item => { const lastRun = executions.find(run => run.workflowId === item.id); const progress = item.active ? Math.min(96, 38 + item.nodes.length * 8) : 0; return <button key={item.id} onClick={() => onWorkflow(item)}><span className="task-progress">{progress}%</span><div><strong>{item.name}</strong><small>{item.nodes.length} steps · {lastRun ? `last run ${lastRun.status}` : item.active ? 'waiting for trigger' : 'paused'}</small><i><span style={{ width: `${progress || 4}%` }} /></i></div><ArrowUpRight size={14} /></button>; })}{!filtered.length && <div className="office-empty"><CircleDashed size={22} /><strong>{connected ? 'No workflows in this view' : 'Connect n8n to populate the office'}</strong><small>{connected ? 'Create a workflow or choose another filter.' : 'Your workflows and runs will appear here.'}</small></div>}</div>
      <div className="rail-health"><span><CheckCircle2 size={14} /> {connected ? 'n8n connected' : 'Not connected'}</span><button onClick={onActivity}><RefreshCw size={13} /> Activity</button></div>
    </aside>
  </div>;
}
