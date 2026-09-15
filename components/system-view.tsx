'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Pause, Play, Eye, EyeOff } from 'lucide-react';
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
import { hasApprovalWebhook, systemMetrics } from '@/lib/ai-crafters';
import type {
  Execution,
  ExecutionDetail,
  Page,
  Workflow,
  WorkflowNode,
} from '@/lib/n8n-types';
const activeStatuses = new Set(['running', 'new', 'waiting']);
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'n8n is unavailable. Please retry.';
}
export function SystemView({
  workflow,
  group,
  n8n,
  executionId,
  onSelectExecution,
  onBack,
  hiddenOnMap,
  onToggleMapVisibility,
}: {
  workflow: Workflow;
  group: string;
  n8n: N8nState;
  executionId: string | null;
  onSelectExecution: (id: string | null, replace?: boolean) => void;
  onBack: () => void;
  hiddenOnMap: boolean;
  onToggleMapVisibility: () => void;
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
  const selectionCallback = useRef(onSelectExecution);
  useEffect(() => {
    selectionCallback.current = onSelectExecution;
  }, [onSelectExecution]);
  const operationController = useRef<AbortController | null>(null);
  const pendingBaseline = useRef<Set<string> | null>(null);
  useEffect(() => () => operationController.current?.abort(), []);
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
        const page = await n8nClientRequest<Page<Execution>>(
          '?resource=executions&workflowId=' + encodeURIComponent(workflow.id),
          { signal: controller.signal },
        );
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
  }, [workflow.id, executionId, revision]);
  async function operate(operation: string, body: unknown = {}) {
    const controller = new AbortController();
    operationController.current?.abort();
    operationController.current = controller;
    setBusy(operation);
    setError('');
    setMessage('');
    const baseline = new Set(runs.data.map((r) => r.id));
    try {
      await n8nClientRequest(
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
      setMessage(
        operation === 'trigger'
          ? 'Run request accepted. Waiting for n8n history.'
          : operation === 'approval'
            ? 'Decision accepted by the dedicated n8n webhook.'
            : 'System state updated.',
      );
      if (operation === 'trigger') {
        pendingBaseline.current = baseline;
        selectionCallback.current(null);
      }
      setRevision((r) => r + 1);
      void n8n.refresh();
    } catch (issue) {
      if (!controller.signal.aborted) setError(errorMessage(issue));
    } finally {
      if (!controller.signal.aborted) setBusy('');
    }
  }
  async function loadMore() {
    setBusy('history');
    try {
      const page = await n8nClientRequest<Page<Execution>>(
        '?resource=executions&workflowId=' +
          encodeURIComponent(workflow.id) +
          '&cursor=' +
          encodeURIComponent(runs.nextCursor || ''),
      );
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
          <span className="eyebrow">{group}</span>
          <h1>{workflow.name}</h1>
        </div>
        <span className="system-activation">
          {workflow.active ? 'Active' : 'Paused'} · {workflow.nodes.length}{' '}
          Agents
        </span>
      </div>
      <div
        className={`execution-context ${detail && !error && activeStatuses.has(detail.status) ? 'current' : 'historical'}`}
      >
        {error ? 'REFRESH UNAVAILABLE · last observed state · ' : ''}
        {detail
          ? activeStatuses.has(detail.status)
            ? `${error ? 'LAST OBSERVED' : 'CURRENT'} EXECUTION #${detail.id} · ${detail.status} · polling n8n`
            : `HISTORICAL EXECUTION #${detail.id} · ${detail.status} · not live`
          : executionId
            ? 'Loading selected execution #' + executionId
            : 'Topology only · no execution selected'}
        <button
          onClick={() => {
            pendingBaseline.current = null;
            onSelectExecution(null);
            setRevision((r) => r + 1);
          }}
        >
          Latest run
        </button>
      </div>
      {(error || message) && (
        <p
          className={`hud-alert ${error ? 'error' : ''}`}
          role={error ? 'alert' : 'status'}
        >
          {error || message}
        </p>
      )}
      <div className={`system-workspace ${error ? 'graph-stale' : ''}`}>
        <AgentGraph
          workflow={workflow}
          detail={detail}
          selected={node}
          onSelect={setNode}
        />
        <aside className="system-sidebar">
          <section className="system-controls">
            <div className="system-controls-heading"><span className="eyebrow">OPERATOR CONTROLS</span><button className="icon-button" onClick={onToggleMapVisibility} aria-label={hiddenOnMap ? 'Show System on map' : 'Hide System from map'} title={hiddenOnMap ? 'Show on map' : 'Hide from map'}>{hiddenOnMap ? <Eye size={16} /> : <EyeOff size={16} />}</button></div>
            <button
              className="primary-action"
              disabled={!!busy}
              onClick={() =>
                void operate('trigger', { source: 'ai-crafters-pro-dashboard' })
              }
            >
              <Play size={17} />
              {busy === 'trigger' ? 'Starting…' : 'Run System'}
            </button>
            <div>
              <button
                className="ghost-action"
                disabled={!!busy}
                onClick={() =>
                  void operate(workflow.active ? 'deactivate' : 'activate')
                }
              >
                {workflow.active ? <Pause size={16} /> : <Play size={16} />}{' '}
                {workflow.active ? 'Pause' : 'Activate'}
              </button>
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
      <ExecutionDrawer
        runs={runs}
        detail={detail}
        busy={!!busy}
        onSelect={(id) => {
          pendingBaseline.current = null;
          onSelectExecution(id);
        }}
        onMore={() => void loadMore()}
        instanceUrl={n8n.data.instanceUrl}
      />
      <Sheet
        open={!!node}
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
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
