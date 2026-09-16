'use client';
import type { RefObject } from 'react';
import { Clock3 } from 'lucide-react';
import { ExecutionDetailPanel } from './agent-inspection';
import type { Execution, ExecutionDetail, Page } from '@/lib/n8n-types';
export function ExecutionDrawer({
  runs,
  detail,
  busy,
  onSelect,
  onMore,
  instanceUrl,
  open,
  onOpenChange,
  workflowName,
  executionDataRef,
}: {
  runs: Page<Execution>;
  detail: ExecutionDetail | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onMore: () => void;
  instanceUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowName: string;
  executionDataRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <details className="execution-drawer" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <summary>
        <Clock3 size={18} />
        <strong>This System's execution history</strong>
        <span>{detail ? `Viewing #${detail.id} · ${workflowName}` : `${runs.data.length} runs · ${workflowName}`}</span>
      </summary>
      <div className="drawer-body">
        {detail && (
          <div ref={executionDataRef} className="execution-data-anchor" tabIndex={-1}>
            <ExecutionDetailPanel detail={detail} instanceUrl={instanceUrl} />
          </div>
        )}
        <div className="execution-history-heading">
          <strong>Run history for this System</strong>
          <span>Only {workflowName} executions are shown</span>
        </div>
        <div className="execution-rows">
          {runs.data.map((run) => (
            <button
              key={run.id}
              aria-pressed={run.id === detail?.id}
              onClick={() => onSelect(run.id)}
            >
              <strong>#{run.id}</strong>
              <span>{run.status}</span>
              <span>
                {run.startedAt
                  ? new Date(run.startedAt).toLocaleString()
                  : 'Time unavailable'}
              </span>
            </button>
          ))}
        </div>
        {!runs.data.length && <p>No executions loaded for this System.</p>}
        {runs.nextCursor && (
          <button className="ghost-action" disabled={busy} onClick={onMore}>
            Load older runs
          </button>
        )}
      </div>
    </details>
  );
}
