'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Pause, Play, Map, EyeOff, Bell, BellOff, CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { n8nClientRequest, type N8nState } from './n8n-panels';
import { AgentGraph } from './agent-graph';
import { AgentInspector, ApprovalPanel, Metric } from './agent-inspection';
import { ExecutionDrawer } from './execution-drawer';
import { WorkflowTour } from './workflow-tour';
import { hasApprovalWebhook, systemMetrics } from '@/lib/ai-crafters';
import type {
  Execution,
  ExecutionDetail,
  Page,
  Workflow,
  WorkflowNode,
  Credential,
} from '@/lib/n8n-types';
const activeStatuses = new Set(['running', 'new', 'waiting']);
function runsForWorkflow(page: Page<Execution>, workflowId: string): Page<Execution> {
  return { ...page, data: page.data.filter((run) => run.workflowId === workflowId) };
}
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'n8n is unavailable. Please retry.';
}
export function SystemView({
  workflow,
  credentials: _credentials,
  n8n,
  executionId,
  onSelectExecution,
  onBack,
  onEditWorkflow,
  onHideFromMap,
}: {
  workflow: Workflow;
  credentials: Credential[];
  n8n: N8nState;
  executionId: string | null;
  onSelectExecution: (id: string | null, replace?: boolean) => void;
  onBack: () => void;
  onEditWorkflow: (workflow: Workflow) => void;
  onHideFromMap: (workflow: Workflow) => void;
}) {
  const [runs, setRuns] = useState<Page<Execution>>({
    data: [],
    nextCursor: null,
  });
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [node, setNode] = useState<WorkflowNode | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [tour, setTour] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(
    () => typeof window === 'undefined' || localStorage.getItem('acp-execution-sound') !== 'off',
  );
  const audioContext = useRef<AudioContext | null>(null);
  const announcedExecution = useRef<string | null>(null);
  const executionResultRef = useRef<HTMLDivElement | null>(null);
  const executionDataRef = useRef<HTMLDivElement | null>(null);
  const selectionCallback = useRef(onSelectExecution);
  useEffect(() => {
    selectionCallback.current = onSelectExecution;
  }, [onSelectExecution]);
  const operationController = useRef<AbortController | null>(null);
  const pendingBaseline = useRef<Set<string> | null>(null);
  useEffect(() => () => operationController.current?.abort(), []);
  function prepareSound() {
    if (!soundEnabled || typeof window === 'undefined') return;
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    audioContext.current ||= new Context();
    void audioContext.current.resume();
  }
  const playCompletionSound = useCallback((failed: boolean) => {
    const context = audioContext.current;
    if (!soundEnabled || !context || context.state !== 'running') return;
    const now = context.currentTime;
    const frequencies = failed ? [190, 145] : [660, 880];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = failed ? 'sawtooth' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * .13);
      gain.gain.exponentialRampToValueAtTime(.06, now + index * .13 + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + index * .13 + .16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + index * .13);
      oscillator.stop(now + index * .13 + .17);
    });
  }, [soundEnabled]);
  function revealExecutionResult() {
    window.requestAnimationFrame(() => {
      (executionDataRef.current || executionResultRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  useEffect(() => {
    let canceled = false;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 3000;
    const controller = new AbortController();
    async function poll() {
      if (document.hidden) {
        timer = setTimeout(poll, 15000);
        return;
      }
      try {
        const page = runsForWorkflow(await n8nClientRequest<Page<Execution>>(
          '?resource=executions&workflowId=' + encodeURIComponent(workflow.id),
          { signal: controller.signal },
        ), workflow.id);
        if (canceled) return;
        setHistoryAvailable(true);
        setRuns((old) =>
          old.data.length > page.data.length
            ? {
                ...old,
                data: [
                  ...page.data,
                  ...old.data.filter(
                    (r) => !page.data.some((n) => n.id === r.id),
                  ),
                ],
              }
            : page,
        );
        const newRun = pendingBaseline.current
          ? page.data.find((r) => !pendingBaseline.current!.has(r.id))
          : null;
        const target = pendingBaseline.current
          ? newRun?.id
          : executionId || page.data[0]?.id;
        if (target) {
          const value = await n8nClientRequest<ExecutionDetail>(
            '?resource=execution&executionId=' + encodeURIComponent(target),
            { signal: controller.signal },
          );
          if (canceled) return;
          if (value.workflowId !== workflow.id)
            throw new Error('This execution belongs to another System.');
          setDetail(value);
          delay = activeStatuses.has(value.status) ? 3000 : 20000;
          if (newRun) {
            pendingBaseline.current = null;
            setMessage(
              'New n8n execution found. Concurrent requests cannot be attributed with certainty.',
            );
            selectionCallback.current(target, true);
          } else if (!activeStatuses.has(value.status) && announcedExecution.current !== value.id) {
            announcedExecution.current = value.id;
            setDrawerOpen(true);
            setMessage(value.status === 'error' ? 'Execution failed. Review the failure diagnosis below.' : 'Execution completed. Output is ready below.');
            playCompletionSound(value.status === 'error');
            revealExecutionResult();
          } else if (!executionId) selectionCallback.current(target, true);
        } else delay = pendingBaseline.current ? 3000 : 20000;
        setError('');
      } catch (issue) {
        if (!canceled) {
          setError(errorMessage(issue));
          delay = Math.min(delay * 2, 60000);
        }
      } finally {
        if (!canceled) timer = setTimeout(poll, delay);
      }
    }
    queueMicrotask(() => {
      if (!canceled) {
        setDetail(null);
        void poll();
      }
    });
    return () => {
      canceled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [workflow.id, executionId, revision, playCompletionSound]);
  async function operate(operation: string, body: unknown = {}) {
    const controller = new AbortController();
    operationController.current?.abort();
    operationController.current = controller;
    setBusy(operation);
    setError('');
    setMessage('');
    if (operation === 'trigger') {
      prepareSound();
      setDrawerOpen(true);
      setNode(null);
    }
    const baseline = new Set(runs.data.map((r) => r.id));
    try {
      const result = await n8nClientRequest<{ status?: string; execution?: ExecutionDetail; runnerInstalled?: boolean }>(
        '?operation=' +
          operation +
          '&workflowId=' +
          encodeURIComponent(workflow.id),
        {
          method: 'POST',
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      if (operation === 'trigger' && result.execution) {
        const completed = result.execution.status === 'error' ? 'failed' : 'completed successfully';
        announcedExecution.current = result.execution.id;
        setDetail(result.execution);
        setRuns((old) => ({
          ...old,
          data: [result.execution!, ...old.data.filter((run) => run.id !== result.execution!.id)],
        }));
        selectionCallback.current(result.execution.id, true);
        // Completion should lead directly to the execution data, not open the
        // optional Agent inspection sidebar over the result area.
        setNode(null);
        setMessage(`Run ${completed}. ${result.runnerInstalled ? 'A dashboard run trigger was added to this manual workflow. ' : ''}Review its output below.`);
        playCompletionSound(result.execution.status === 'error');
        revealExecutionResult();
      } else setMessage(
        operation === 'trigger'
          ? 'Run started. Live execution details will appear below as n8n records them.'
          : operation === 'approval'
            ? 'Decision accepted by the dedicated n8n webhook.'
            : 'System state updated.',
      );
      if (operation === 'trigger') {
        if (!result.execution) {
          pendingBaseline.current = baseline;
          selectionCallback.current(null);
        }
      }
      setRevision((r) => r + 1);
      void n8n.refresh();
    } catch (issue) {
      if (!controller.signal.aborted) {
        if (operation === 'trigger') playCompletionSound(true);
        setError(errorMessage(issue));
        if (operation === 'trigger') revealExecutionResult();
      }
    } finally {
      if (!controller.signal.aborted) setBusy('');
    }
  }
  async function loadMore() {
    setBusy('history');
    try {
      const page = runsForWorkflow(await n8nClientRequest<Page<Execution>>(
        '?resource=executions&workflowId=' +
          encodeURIComponent(workflow.id) +
          '&cursor=' +
          encodeURIComponent(runs.nextCursor || ''),
      ), workflow.id);
      setRuns((old) => ({
        data: [
          ...old.data,
          ...page.data.filter((r) => !old.data.some((v) => v.id === r.id)),
        ],
        nextCursor: page.nextCursor,
      }));
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy('');
    }
  }
  const metrics = systemMetrics(runs.data);
  const primaryControlLabel = busy === 'trigger'
    ? 'Starting…'
    : busy === 'deactivate'
      ? 'Pausing…'
      : workflow.active
        ? 'Pause System'
        : 'Run System';
  return (
    <div className="system-view">
      <div className="system-heading">
        <button
          className="icon-button"
          aria-label="Back to all Systems"
          onClick={onBack}
        >
          <ArrowLeft size={19} />
        </button>
        <div>
          <h1>{workflow.name}</h1>
        </div>
        <button className="ghost-action" onClick={() => onHideFromMap(workflow)}>
          <EyeOff size={16} /> Hide from map
        </button>
        <button className="ghost-action tour-launch-action" onClick={() => { setTour(true); setNode(workflow.nodes[0] || null); }}>
          <Map size={16} /> Guided tour
        </button>
      </div>
      {(error || message) && (
        <p
          className={`hud-alert execution-toast ${error ? 'error' : detail?.status === 'error' ? 'error' : ''}`}
          role={error ? 'alert' : 'status'}
        >
          {error ? <CircleAlert size={18} /> : detail && !activeStatuses.has(detail.status) ? <CheckCircle2 size={18} /> : <LoaderCircle size={18} className="spin-icon" />}
          <span>{error || message}</span>
        </p>
      )}
      <div className={`system-workspace ${error ? 'graph-stale' : ''}`}>
        <AgentGraph
          workflow={workflow}
          detail={detail}
          selected={node}
          touring={tour}
          onStartTour={() => { setTour(true); setNode(workflow.nodes[0] || null); }}
          onSelect={setNode}
        />
        <aside className="system-sidebar">
          <section className="system-controls">
            <div className="system-controls-heading"><span className="eyebrow">OPERATOR CONTROLS</span></div>
            <button
              className="primary-action"
              disabled={!!busy}
              onClick={() => void operate(
                workflow.active ? 'deactivate' : 'trigger',
                workflow.active ? {} : { source: 'ai-crafters-pro-dashboard' },
              )}
            >
              {workflow.active ? <Pause size={17} /> : <Play size={17} />}
              {primaryControlLabel}
            </button>
            <button
              className="sound-toggle"
              aria-pressed={soundEnabled}
              title={soundEnabled ? 'Turn completion sounds off' : 'Turn completion sounds on'}
              onClick={() => setSoundEnabled((enabled) => { const next = !enabled; localStorage.setItem('acp-execution-sound', next ? 'on' : 'off'); return next; })}
            >
              {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />} {soundEnabled ? 'Sound on' : 'Sound off'}
            </button>
            <div>
              <button
                className="icon-button"
                aria-label="Refresh System"
                onClick={() => setRevision((r) => r + 1)}
              >
                <RefreshCw size={17} />
              </button>
            </div>
          </section>
          <section className="metric-section">
            <span className="eyebrow">
              {historyAvailable
                ? 'Last ' + metrics.runCount + ' loaded runs'
                : 'History unavailable / loading'}
            </span>
            <div className="metric-grid">
              <Metric
                label="Success rate"
                value={
                  metrics.successRate === null ? '—' : metrics.successRate + '%'
                }
              />
              <Metric
                label="Avg duration"
                value={
                  metrics.averageDurationMs === null
                    ? '—'
                    : (metrics.averageDurationMs / 1000).toFixed(1) + 's'
                }
              />
              <Metric
                label="Failures"
                value={historyAvailable ? String(metrics.failures) : '—'}
              />
              <Metric
                label="Last run"
                value={
                  runs.data[0]?.startedAt
                    ? new Date(runs.data[0].startedAt).toLocaleDateString()
                    : '—'
                }
              />
            </div>
          </section>
          <ApprovalPanel
            enabled={hasApprovalWebhook(workflow)}
            detail={detail}
            busy={busy}
            onAction={(action) =>
              void operate('approval', { action, executionId: detail?.id })
            }
          />
        </aside>
      </div>
      <div ref={executionResultRef} className="execution-result-anchor" tabIndex={-1}>
        <ExecutionDrawer
          runs={runs}
          workflowName={workflow.name}
          detail={detail}
          busy={!!busy}
          onSelect={(id) => {
            pendingBaseline.current = null;
            onSelectExecution(id);
          }}
          onMore={() => void loadMore()}
          instanceUrl={n8n.data.instanceUrl}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          executionDataRef={executionDataRef}
        />
      </div>
      <Sheet
        open={!tour && !!node}
        onOpenChange={(open) => {
          if (!open) setNode(null);
        }}
      >
        <SheetContent className="acp-sheet">
          <SheetHeader>
            <SheetTitle>Agent inspection</SheetTitle>
            <SheetDescription>
              Execution evidence from n8n. Unreported Agents are not presumed
              running.
            </SheetDescription>
          </SheetHeader>
          {node && (
          <AgentInspector
              node={node}
              workflow={workflow}
              detail={detail}
            onClose={() => setNode(null)}
            onEdit={() => onEditWorkflow(workflow)}
            />
          )}
        </SheetContent>
      </Sheet>
      {tour && <WorkflowTour workflow={workflow} node={node} onNode={setNode} onClose={() => { setTour(false); setNode(null); }} />}
    </div>
  );
}
