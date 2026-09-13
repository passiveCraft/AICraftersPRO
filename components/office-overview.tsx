'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Activity, AlertCircle, ArrowLeft, ArrowUpRight, Box, Check,
  ChevronDown, ChevronRight, ChevronUp, Clock3, Code2, Eye, EyeOff,
  GitBranch, Globe2, Layers3, LayoutGrid, Loader2, Maximize2, Minus,
  Network, PanelRightClose, PanelRightOpen, Plus, RefreshCw, Search,
  TerminalSquare, Trash2, Webhook,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ThreeOfficeScene } from '@/components/three-office-scene';
import type { Execution, ExecutionDetail, Page, Workflow, WorkflowNode } from '@/lib/n8n-types';

type Props = {
  workflows: Workflow[]; executions: Execution[]; connected: boolean; light: boolean;
  onWorkflow: (workflow: Workflow) => void; onWorkflows: () => void;
  onCreate: () => void; onActivity: () => void; onConnect: () => void; onChanged: () => Promise<void> | void;
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
function latestRun(runs: Execution[], id: string) {
  return runs.filter(r => r.workflowId === id).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))[0];
}
function stamp(date: string | null) {
  return date ? new Date(date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No runs yet';
}
function readable(value: unknown) {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try { return JSON.stringify(value, null, 2); } catch { return 'Output could not be displayed.'; }
}
function compactValue(value: unknown) {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return 'Unserializable value'; }
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const h = new Headers(init?.headers); h.set('Content-Type', 'application/json');
  const res = await fetch(`/api/n8n${path}`, { ...init, credentials: 'same-origin', cache: 'no-store', headers: h });
  const body: unknown = await res.json().catch(() => ({}));
  const err = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (!res.ok) throw new Error(typeof err.error === 'string' ? err.error : 'n8n could not complete this run.');
  return body as T;
}

// ─── status helpers ──────────────────────────────────────────────────────────
function isStillRunning(status: string) { return status === 'running' || status === 'new' || status === 'waiting'; }
function runStatusClass(status: string) {
  if (status === 'success') return 'run-success';
  if (status === 'error' || status === 'crashed') return 'run-error';
  if (isStillRunning(status)) return 'run-running';
  return '';
}
function prependLogs(setter: Dispatch<SetStateAction<string[]>>, lines: string[], limit = 40) {
  setter(items => [...lines, ...items].slice(0, limit));
}

export function OfficeOverview({ workflows, executions, connected, light, onWorkflow, onWorkflows, onCreate, onActivity, onConnect, onChanged }: Props) {
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
  const [session, setSession] = useState<ExecutionDetail | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const loggedExecutionIds = useRef(new Set<string>());
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleStepName, setConsoleStepName] = useState<string | null>(null);
  const [consoleView, setConsoleView] = useState<'input' | 'output'>('output');
  const [runLog, setRunLog] = useState<string[]>(() => [`ready · execute ${workflows[0]?.name || 'this workflow'} from this workspace`]);

  useEffect(() => {
    setSidebar(localStorage.getItem('operator-sidebar') !== 'hidden');
    if (localStorage.getItem('operator-layout-v2') === 'islands') setLayoutMode('islands');
  }, []);

  function toggleSidebar() { setSidebar(v => { localStorage.setItem('operator-sidebar', v ? 'hidden' : 'visible'); return !v; }); }
  function toggleLayout() { setLayoutMode(v => { const next = v === 'floor' ? 'islands' : 'floor'; localStorage.setItem('operator-layout-v2', next); return next; }); }

  const activeFlow = workflows.find(w => w.id === selected?.workflowId);
  const activeNode = activeFlow?.nodes.find(n => n.id === selected?.nodeId);
  const activeStep = activeNode ? session?.steps.find(s => s.name === activeNode.name) : undefined;
  const filtered = workflows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) &&
    (filter === 'all' || (filter === 'active' ? w.active : !w.active))
  );

  // ── execution loading ──────────────────────────────────────────────────────
  async function loadExecution(executionId: string) {
    setSessionBusy(true);
    setSessionError(null);
    try {
      const detail = await api<ExecutionDetail>(`?resource=execution&executionId=${encodeURIComponent(executionId)}`);
      setSession(detail);
      return detail;
    } catch (e) {
      setSession(null);
      setSessionError(e instanceof Error ? e.message : 'Could not load execution.');
      return null;
    } finally {
      setSessionBusy(false);
    }
  }

  async function loadLatestExecution(workflowId: string) {
    const runs = await api<Page<Execution>>(`?resource=executions&workflowId=${encodeURIComponent(workflowId)}`);
    // Pick the latest completed execution (not stuck "running") first, fall back to any
    const best = runs.data.find(r => r.workflowId === workflowId && !isStillRunning(r.status))
      ?? runs.data.find(r => r.workflowId === workflowId);
    return best ? loadExecution(best.id) : null;
  }

  function appendExecutionLogs(detail: ExecutionDetail) {
    if (loggedExecutionIds.current.has(detail.id)) return;
    loggedExecutionIds.current.add(detail.id);
    const duration = detail.startedAt && detail.stoppedAt
      ? `${Math.max(0, Date.parse(detail.stoppedAt) - Date.parse(detail.startedAt))} ms`
      : 'duration pending';
    const time = new Date(detail.stoppedAt || detail.startedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const stepLines = detail.steps.flatMap(step => {
      const base = `${time} · step · ${step.name} · ${step.status}${step.durationMs !== null ? ` · ${step.durationMs} ms` : ''}`;
      if (step.error) return [`${base} · ${step.error}`];
      if (step.output === undefined) return [base];
      const output = typeof step.output === 'string' ? step.output : JSON.stringify(step.output);
      return [base, `${time} · output · ${step.name} · ${output.slice(0, 600)}`];
    });
    const lines = [`${time} · execution #${detail.id} · ${detail.status} · ${duration}`, ...stepLines];
    prependLogs(setRunLog, lines);
  }

  async function waitForNewExecution(workflowId: string, previousIds: Set<string>, triggeredAt: number) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const runs = await api<Page<Execution>>(`?resource=executions&workflowId=${encodeURIComponent(workflowId)}`);
      const next = runs.data.find(run => run.workflowId === workflowId && !previousIds.has(run.id) && (!run.startedAt || Date.parse(run.startedAt) >= triggeredAt - 2_000));
      if (next) {
        if (isStillRunning(next.status)) return pollExecution(next.id);
        return loadExecution(next.id);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
  }

  useEffect(() => {
    const workflow = workflows[0];
    if (!workflow) return;
    const recent = latestRun(executions, workflow.id);
    if (!recent || loggedExecutionIds.current.has(recent.id)) return;
    let canceled = false;
    void api<ExecutionDetail>(`?resource=execution&executionId=${encodeURIComponent(recent.id)}`).then(detail => {
      if (!canceled) { setSession(detail); appendExecutionLogs(detail); }
    }).catch(() => undefined);
    return () => { canceled = true; };
  }, [executions, workflows]);

  // ── inspect: always loads the latest session when a node is clicked ────────
  function inspect(workflow: Workflow, node?: WorkflowNode) {
    setSelected({ workflowId: workflow.id, nodeId: node?.id });
    if (node) { setConsoleStepName(node.name); setConsoleView('output'); }
    setSidebar(true);
    requestAnimationFrame(() => inspectorRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
    if (node) {
      const recent = latestRun(executions, workflow.id);
      // Always reload if we don't already have this execution in session
      if (recent && session?.id !== recent.id) {
        void loadExecution(recent.id);
      }
      // If we have no runs in the prop list but a session is loaded, keep it
    }
  }

  // ── poll a running execution until it finishes (max 30 s, 2 s intervals) ──
  async function pollExecution(executionId: string): Promise<ExecutionDetail | null> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const detail = await api<ExecutionDetail>(`?resource=execution&executionId=${encodeURIComponent(executionId)}`);
        if (!isStillRunning(detail.status)) {
          setSession(detail);
          return detail;
        }
      } catch { break; }
      await new Promise(res => setTimeout(res, 2000));
    }
    return null;
  }

  // ── run ───────────────────────────────────────────────────────────────────
  const runnableFlow = activeFlow || workflows.find(w => w.active) || workflows[0];
  async function runWorkflow(workflow = runnableFlow) {
    setConsoleOpen(true);
    if (!workflow) {
      prependLogs(setRunLog, [`${stamp(new Date().toISOString())} · no workflow selected`]);
      return;
    }
    const hasWebhook = workflow.nodes.some(n => n.type.endsWith('.webhook') && !n.disabled);
    const hasManualTrigger = workflow.nodes.some(n => n.type.endsWith('.manualTrigger') && !n.disabled);
    if (!hasWebhook && !hasManualTrigger) {
      prependLogs(setRunLog, [`${stamp(new Date().toISOString())} · ${workflow.name} has no manual or webhook entry point`]);
      return;
    }

    const t0 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const previousExecutionIds = new Set(executions.filter(run => run.workflowId === workflow.id).map(run => run.id));
    setRunBusy(true);
    setRunningWorkflowId(workflow.id);
    setSession(null);
    setSessionError(null);
    prependLogs(setRunLog, [`${t0} · ${hasWebhook ? workflow.active ? 'run started' : 'publishing webhook and starting run' : 'preparing dashboard runner and starting run'} · ${workflow.name}`]);

    try {
      try {
        const before = await api<Page<Execution>>(`?resource=executions&workflowId=${encodeURIComponent(workflow.id)}`);
        for (const execution of before.data) previousExecutionIds.add(execution.id);
      } catch { /* The run can proceed even when execution history is temporarily unavailable. */ }
      const triggeredAt = Date.now();
      const output = await api<{ status: string; output: unknown; runnerInstalled?: boolean }>(
        `?operation=trigger&workflowId=${encodeURIComponent(workflow.id)}`,
        { method: 'POST', body: JSON.stringify({ source: 'operator-core-workspace', sample: true, ts: new Date().toISOString() }), signal: AbortSignal.timeout(45000) }
      );
      const t1 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const summary = typeof output.output === 'string' ? output.output : JSON.stringify(output.output);
      prependLogs(setRunLog, [`${t1} · success${output.runnerInstalled ? ' · dashboard runner installed' : ''} · ${summary?.slice(0, 140) || 'workflow completed'}`]);
      // Load latest execution so node output appears immediately
      try {
        const [, detail] = await Promise.all([onChanged(), waitForNewExecution(workflow.id, previousExecutionIds, triggeredAt)]);
        if (detail) appendExecutionLogs(detail);
        else prependLogs(setRunLog, [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · run succeeded · n8n execution details are still pending`]);
      } catch (syncIssue) {
        prependLogs(setRunLog, [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · run succeeded · refresh pending · ${syncIssue instanceof Error ? syncIssue.message : 'Execution details are not available yet.'}`]);
      }

    } catch (issue) {
      const t1 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const timedOut = issue instanceof Error && (issue.name === 'TimeoutError' || issue.name === 'AbortError');
      const msg = timedOut
        ? 'Webhook timed out after 45 s — polling n8n for the execution…'
        : issue instanceof Error ? issue.message : 'Workflow run failed.';
      prependLogs(setRunLog, [`${t1} · ${timedOut ? 'timeout' : 'error'} · ${msg}`]);

      if (timedOut) {
        // Find the in-progress execution and poll until it settles
        try {
          const runs = await api<Page<Execution>>(`?resource=executions&workflowId=${encodeURIComponent(workflow.id)}`);
          const inProgress = runs.data.find(r => r.workflowId === workflow.id && isStillRunning(r.status));
          if (inProgress) {
            const settled = await pollExecution(inProgress.id);
            if (settled) {
              const t2 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              prependLogs(setRunLog, [`${t2} · ${settled.status} · execution #${settled.id} settled`]);
            } else {
              // Timed out polling too — just grab latest
              await loadLatestExecution(workflow.id).catch(() => null);
            }
          } else {
            // No running execution found — grab latest completed one
            await loadLatestExecution(workflow.id).catch(() => null);
          }
        } catch {
          await loadLatestExecution(workflow.id).catch(() => null);
        }
      } else {
        // Non-timeout failure: still try to surface whatever n8n recorded
        await loadLatestExecution(workflow.id).catch(() => null);
      }
    } finally {
      setRunBusy(false);
      setRunningWorkflowId(undefined);
    }
  }

  // ─── render ───────────────────────────────────────────────────────────────
  const workflowRuns = activeFlow ? executions.filter(r => r.workflowId === activeFlow.id) : [];
  const consoleStep = session?.steps.find(step => step.name === consoleStepName) ?? session?.steps.at(-1);
  const consoleWorkflow = activeFlow ?? workflows[0];
  const consoleInputNames = consoleWorkflow && consoleStep ? consoleWorkflow.edges.filter(edge => edge.to === consoleStep.name).map(edge => edge.from) : [];
  const consoleInput = session?.steps.filter(step => consoleInputNames.includes(step.name)).flatMap(step => step.output === undefined ? [] : Array.isArray(step.output) ? step.output : [step.output]);
  const consoleValue = consoleView === 'output' ? consoleStep?.output : consoleInput;
  const consoleItems = consoleValue === undefined ? [] : Array.isArray(consoleValue) ? consoleValue : [consoleValue];
  const consoleColumns = Array.from(new Set(consoleItems.flatMap(item => item && typeof item === 'object' && !Array.isArray(item) ? Object.keys(item as Record<string, unknown>) : []))).slice(0, 10);
  const sessionDuration = session?.startedAt && session.stoppedAt ? Math.max(0, Date.parse(session.stoppedAt) - Date.parse(session.startedAt)) : null;

  return (
    <div className={`office-layout ${sidebar ? '' : 'sidebar-hidden'}`}>
      {/* ── left: 3-D canvas ─────────────────────────────────────────────── */}
      <section className={`office-map ${consoleOpen ? 'console-open' : ''}`} aria-label="Workflow workspace">
        <div className="workspace-toolbar controls-only">
          <div className="workspace-toolbar-actions">
            <button onClick={onCreate}><Plus size={17} /> New workflow</button>
            <button className={`label-toggle ${labelsVisible ? 'is-active' : ''}`} onClick={() => setLabelsVisible(v => !v)} aria-label={labelsVisible ? 'Hide workspace labels' : 'Show workspace labels'} title={labelsVisible ? 'Hide labels' : 'Show labels'}>
              {labelsVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button className={`layout-toggle ${layoutMode === 'islands' ? 'is-active' : ''}`} onClick={toggleLayout} aria-pressed={layoutMode === 'islands'} aria-label={layoutMode === 'floor' ? 'Switch to node islands' : 'Switch to team floor'} title={layoutMode === 'floor' ? 'Node islands view' : 'Team floor view'}>
              {layoutMode === 'floor' ? <Layers3 size={18} /> : <LayoutGrid size={18} />}
            </button>
            <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebar ? 'Hide sidebar' : 'Show sidebar'}>
              {sidebar ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
            </button>
          </div>
        </div>

        <div className="workspace-stage">
          {workflows.length
            ? <ThreeOfficeScene workflows={workflows} executions={executions} session={session} light={light} zoom={zoom} resetViewKey={resetViewKey} labelsVisible={labelsVisible} layoutMode={layoutMode} runningWorkflowId={runningWorkflowId} selectedWorkflowId={activeFlow?.id} selectedNodeId={activeNode?.id} onZoomChange={v => setZoom(Number(v.toFixed(3)))} onInspect={inspect} onExecute={(w) => { setSelected({ workflowId: w.id }); void runWorkflow(w); }} />
            : (
              <div className="empty-office">
                <span><Network size={36} strokeWidth={1.3} /></span>
                <h2>{connected ? 'Your office is ready' : 'Your workflows belong here'}</h2>
                <p>{connected ? 'Create your first workflow or import an existing n8n workflow in the editor.' : 'Start n8n and connect it to bring every workflow into this workspace.'}</p>
                <button onClick={connected ? onCreate : onConnect}>{connected ? <Plus size={17} /> : <Network size={17} />}{connected ? 'Create workflow' : 'Connect n8n'}</button>
              </div>
            )}
        </div>

        {/* ── run console ──────────────────────────────────────────────────── */}
        <div className={`workspace-runbar ${consoleOpen ? 'is-open' : ''} ${runBusy ? 'is-busy' : ''}`}>
          {/* header row */}
          <button className="runbar-console-toggle" onClick={() => setConsoleOpen(v => !v)} aria-expanded={consoleOpen}>
            <span className="runbar-icon">
              {runBusy ? <Loader2 size={14} className="spin-icon" /> : <TerminalSquare size={14} />}
            </span>
            <span className="runbar-title">Logs</span>
            {runnableFlow && (
              <span className="runbar-target">
                <Network size={11} />
                {runnableFlow.name}
              </span>
            )}
            <span className="runbar-count">{session ? `#${session.id}` : runLog.length}</span>
            {consoleOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {/* n8n-style execution inspector */}
          {consoleOpen && (
            session ? (
              <div className="execution-console" aria-label={`Execution ${session.id} details`}>
                <aside className="execution-console-steps">
                  <header>
                    <div><strong className={runStatusClass(session.status)}>{session.status === 'success' ? 'Success' : session.status}</strong>{sessionDuration !== null && <span>in {sessionDuration}ms</span>}</div>
                    <button onClick={() => { setSession(null); setConsoleStepName(null); setConsoleView('output'); loggedExecutionIds.current.clear(); setRunLog([`ready · execute ${workflows[0]?.name || 'this workflow'} from this workspace`]); }}><Trash2 size={13} /> Clear</button>
                  </header>
                  <nav aria-label="Executed nodes">
                    {session.steps.map(step => (
                      <button key={step.name} className={consoleStep?.name === step.name ? 'active' : ''} onClick={() => { setConsoleStepName(step.name); setConsoleView('output'); const node = consoleWorkflow?.nodes.find(item => item.name === step.name); if (consoleWorkflow && node) setSelected({ workflowId: consoleWorkflow.id, nodeId: node.id }); }}>
                        <span className={step.status}>{step.status === 'success' ? <Check size={13} /> : <AlertCircle size={13} />}</span>
                        <strong>{step.name}</strong>
                        <small>{step.durationMs !== null ? `${step.durationMs}ms` : step.status}</small>
                      </button>
                    ))}
                  </nav>
                </aside>
                <section className="execution-console-output">
                  <header>
                    <div><strong>{consoleStep?.name || 'Execution output'}</strong><span className={consoleStep?.status}>{consoleStep?.status}{consoleStep?.durationMs !== null && consoleStep?.durationMs !== undefined ? ` in ${consoleStep.durationMs}ms` : ''}</span></div>
                    <div className="execution-data-tabs"><button className={consoleView === 'input' ? 'active' : ''} onClick={() => setConsoleView('input')} aria-pressed={consoleView === 'input'}>Input</button><button className={consoleView === 'output' ? 'active' : ''} onClick={() => setConsoleView('output')} aria-pressed={consoleView === 'output'}>Output</button><span>{consoleItems.length} {consoleItems.length === 1 ? 'item' : 'items'}</span></div>
                  </header>
                  {consoleStep?.error ? <div className="execution-console-error"><AlertCircle size={15} /><div><strong>{consoleStep.error}</strong>{consoleStep.hint && <small>{consoleStep.hint}</small>}</div></div>
                    : !consoleItems.length ? <div className="execution-console-empty">This step produced no output.</div>
                      : consoleColumns.length ? (
                        <div className="execution-output-table-wrap"><table><thead><tr><th>#</th>{consoleColumns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{consoleItems.map((item, index) => { const record = item as Record<string, unknown>; return <tr key={index}><td>{index + 1}</td>{consoleColumns.map(column => <td key={column}>{compactValue(record[column])}</td>)}</tr>; })}</tbody></table></div>
                      ) : <pre className="execution-output-json">{readable(consoleValue)}</pre>}
                </section>
              </div>
            ) : (
              <div className="run-terminal" aria-label="Workflow run activity">
                {sessionBusy && <div className="run-line run-line-info"><Loader2 size={12} className="spin-icon" /><code>Reading the latest execution from n8n…</code></div>}
                {runLog.map((line, i) => {
                  const kind = line.includes(' · error ') || line.includes('Cannot read') ? 'err' : line.includes(' · success') ? 'ok' : line.includes(' · timeout ') ? 'warn' : line.includes('run started') || line.includes('starting run') ? 'info' : 'dim';
                  return <div key={`${line}-${i}`} className={`run-line run-line-${kind}`}><span className="run-line-dot" /><code>{line}</code></div>;
                })}
              </div>
            )
          )}
        </div>

        <div className="workspace-bottom">
          <div className="office-zoom-controls">
            <button title="Zoom in" aria-label="Zoom in workspace" onClick={() => setZoom(v => Math.min(3.2, Number((v + .2).toFixed(2))))}>
              <Plus size={20} />
            </button>
            <button title="Zoom out" aria-label="Zoom out workspace" onClick={() => setZoom(v => Math.max(.55, Number((v - .16).toFixed(2))))}>
              <Minus size={20} />
            </button>
            <button title="Reset view" aria-label="Reset workspace position and zoom" onClick={() => { setZoom(1); setResetViewKey(v => v + 1); }}>
              <Maximize2 size={17} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </section>

      {/* ── right: sidebar ───────────────────────────────────────────────── */}
      {sidebar && (
        <aside className="task-rail" aria-label="Workspace details">
          <header className="rail-heading">
            <div>
              <span className="workspace-overline">{activeFlow ? (activeNode ? 'STEP DETAILS' : 'WORKFLOW DETAILS') : 'TASK STATUS'}</span>
              <h2>{activeFlow ? (activeNode ? 'Inside the step' : activeFlow.name) : 'Whole office'}</h2>
            </div>
            <button aria-label="Hide sidebar" onClick={toggleSidebar}><PanelRightClose size={19} /></button>
          </header>

          {activeFlow ? (
            <div className="workspace-inspector" ref={inspectorRef}>
              <button className="inspector-back" onClick={() => activeNode ? setSelected({ workflowId: activeFlow.id }) : setSelected(null)}>
                <ArrowLeft size={15} />{activeNode ? 'Workflow details' : 'Whole office'}
              </button>

              <div className="inspector-identity">
                <span>
                  {activeNode
                    ? (() => { const Icon = nodeIcon(activeNode.type); return <Icon size={27} />; })()
                    : <Network size={27} />}
                </span>
                <h3>{activeNode?.name || activeFlow.name}</h3>
                <p>{activeNode ? nodeKind(activeNode.type) : activeFlow.active ? 'Active · waiting for its trigger' : 'Inactive workflow'}</p>
              </div>

              <dl className="workspace-facts">
                {activeNode ? (
                  <>
                    <div><dt>State</dt><dd>{activeNode.disabled ? 'Disabled' : 'Enabled'}</dd></div>
                    <div><dt>Node version</dt><dd>{activeNode.typeVersion}</dd></div>
                    <div><dt>Node type</dt><dd>{activeNode.type}</dd></div>
                  </>
                ) : (
                  <>
                    <div><dt>Steps</dt><dd>{activeFlow.nodes.length}</dd></div>
                    <div><dt>Connections</dt><dd>{activeFlow.edges.length}</dd></div>
                    <div><dt>Last updated</dt><dd>{stamp(activeFlow.updatedAt)}</dd></div>
                    <div><dt>Tags</dt><dd>{activeFlow.tags.join(', ') || 'No tags'}</dd></div>
                  </>
                )}
              </dl>

              {activeNode ? (
                <>
                  {/* ── NODE OUTPUT panel ─────────────────────────────── */}
                  <section className={`node-session-output ${activeStep?.status ?? (sessionBusy ? 'loading' : '')}`}>
                    <header className="node-session-header">
                      <div className="node-session-title">
                        <span className="node-session-label">NODE OUTPUT</span>
                        <span className="node-session-exec">
                          {session ? `Execution #${session.id}` : sessionBusy ? 'Loading…' : 'No session loaded'}
                        </span>
                      </div>
                      <div className="node-session-controls">
                        {/* status chip */}
                        {sessionBusy
                          ? <span className="node-chip chip-loading"><Loader2 size={12} className="spin-icon" />Loading</span>
                          : activeStep?.status === 'success'
                            ? <span className="node-chip chip-success"><Check size={12} />Success</span>
                            : activeStep?.status === 'error'
                              ? <span className="node-chip chip-error"><AlertCircle size={12} />Error</span>
                              : session
                                ? <span className="node-chip chip-muted">Not executed</span>
                                : null}
                        {/* reload button */}
                        {!sessionBusy && workflowRuns.length > 0 && (
                          <button
                            className="node-session-reload"
                            title="Reload latest execution"
                            onClick={() => void loadLatestExecution(activeFlow.id)}
                          >
                            <RefreshCw size={13} />
                          </button>
                        )}
                      </div>
                    </header>

                    {/* error message from the step */}
                    {activeStep?.error && (
                      <div className="node-session-error">
                        <AlertCircle size={14} />
                        <span>{activeStep.error}</span>
                        {activeStep.hint && <small>{activeStep.hint}</small>}
                      </div>
                    )}

                    {/* output or empty state */}
                    {activeStep?.output !== undefined ? (
                      <pre className="node-session-pre">{readable(activeStep.output)}</pre>
                    ) : (
                      <div className="node-session-empty">
                        {sessionBusy
                          ? 'Reading execution data from n8n…'
                          : sessionError
                            ? `Could not load: ${sessionError}`
                            : session
                              ? 'This node did not produce output in this execution.'
                              : 'Run the workflow to see this node\'s output here.'}
                      </div>
                    )}

                    {/* duration footer */}
                    {activeStep?.durationMs != null && (
                      <footer className="node-session-footer">
                        <Clock3 size={12} />{activeStep.durationMs} ms · stored by n8n
                      </footer>
                    )}
                  </section>

                  {/* run picker — shown when a session is loaded */}
                  {workflowRuns.length > 0 && (
                    <div className="node-run-picker">
                      <span className="node-run-picker-label">Switch execution</span>
                      <div className="node-run-picker-list">
                        {workflowRuns.slice(0, 6).map(run => (
                          <button
                            key={run.id}
                            className={`node-run-pill ${runStatusClass(run.status)} ${session?.id === run.id ? 'active' : ''}`}
                            onClick={() => void loadExecution(run.id)}
                            disabled={sessionBusy}
                          >
                            {run.status === 'success'
                              ? <Check size={11} />
                              : isStillRunning(run.status)
                                ? <Loader2 size={11} className="spin-icon" />
                                : <AlertCircle size={11} />}
                            <span>#{run.id}</span>
                            <small>{stamp(run.startedAt)}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* connections */}
                  <h4>Connections</h4>
                  <div className="detail-connections">
                    {activeFlow.edges
                      .filter(e => e.from === activeNode.name || e.to === activeNode.name)
                      .map((e, i) => (
                        <div key={i}>
                          <GitBranch size={15} />
                          <span>{e.from}<ChevronRight size={13} />{e.to}</span>
                          <small>{e.type} · output {e.output ?? 0}</small>
                        </div>
                      ))}
                  </div>

                  <details className="detail-parameters">
                    <summary>View parameters</summary>
                    <pre>{JSON.stringify(activeNode.parameters, null, 2)}</pre>
                  </details>
                </>
              ) : (
                <>
                  <h4>Steps in this workflow</h4>
                  <div className="detail-steps">
                    {activeFlow.nodes.map(node => {
                      const Icon = nodeIcon(node.type);
                      return (
                        <button key={node.id} onClick={() => inspect(activeFlow, node)}>
                          <Icon size={17} />
                          <span>{node.name}<small>{nodeKind(node.type)}</small></span>
                          <ChevronRight size={15} />
                        </button>
                      );
                    })}
                  </div>

                  <h4>Execution sessions</h4>
                  <div className="detail-runs execution-sessions">
                    {workflowRuns.slice(0, 5).map(run => (
                      <button
                        key={run.id}
                        className={session?.id === run.id ? 'selected' : ''}
                        onClick={() => void loadExecution(run.id)}
                      >
                        <span className={runStatusClass(run.status)}>
                          {run.status === 'success'
                            ? <Check size={15} />
                            : isStillRunning(run.status)
                              ? <Loader2 size={15} className="spin-icon" />
                              : <AlertCircle size={15} />}
                          {run.status}
                        </span>
                        <small>#{run.id} · {stamp(run.startedAt)}</small>
                      </button>
                    ))}
                    {!workflowRuns.length && <p>No executions recorded yet.</p>}
                  </div>
                </>
              )}

              <div className="inspector-actions-row">
                <button onClick={() => void runWorkflow(activeFlow)} disabled={runBusy}>
                  {runBusy ? <Loader2 size={16} className="spin-icon" /> : <Activity size={16} />} Execute here
                </button>
                <button className="inspector-open" onClick={() => onWorkflow(activeFlow)}>
                  Open editor <ArrowUpRight size={17} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rail-summary">
                <div><strong>{workflows.length}</strong><span>Workflows</span></div>
                <div><strong>{workflows.filter(w => w.active).length}</strong><span>Active</span></div>
                <div><strong>{executions.length}</strong><span>Recent runs</span></div>
              </div>
              <div className="task-filters">
                {['all', 'active', 'inactive'].map(v => (
                  <button key={v} onClick={() => setFilter(v)} className={filter === v ? 'active' : ''}>
                    {v[0].toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
              <div className="task-search"><Search size={17} /><Input aria-label="Search workflows" placeholder="Search workflows…" value={search} onChange={e => setSearch(e.target.value)} /></div>
              <div className="office-task-list">
                {filtered.map(workflow => {
                  const run = latestRun(executions, workflow.id);
                  return (
                    <button key={workflow.id} onClick={() => inspect(workflow)}>
                      <span className="task-workflow-icon"><Network size={19} /></span>
                      <div>
                        <strong>{workflow.name}</strong>
                        <small>{workflow.nodes.length} steps · {workflow.active ? 'Active' : 'Inactive'}</small>
                        <span className="task-run-state">{run ? `Last run · ${run.status}` : 'No runs yet'}</span>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  );
                })}
                {!filtered.length && <p className="rail-empty">{connected ? 'No workflows match this view.' : 'Start n8n to restore your workflows.'}</p>}
              </div>
              <button className="rail-library" onClick={onWorkflows}>Browse workflow library <ArrowUpRight size={16} /></button>
            </>
          )}

          <footer className="rail-health">
            <button onClick={onConnect}><i className={connected ? 'connected' : ''} />{connected ? 'n8n connected' : 'Connect n8n'}</button>
            <button onClick={onActivity}><Activity size={16} /> Activity</button>
          </footer>
        </aside>
      )}
    </div>
  );
}
