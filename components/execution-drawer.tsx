'use client';
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
}: {
  runs: Page<Execution>;
  detail: ExecutionDetail | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onMore: () => void;
  instanceUrl?: string;
}) {
  return (
    <details className="execution-drawer">
      <summary>
        <Clock3 size={18} />
        <strong>Execution history</strong>
        <span>{runs.data.length} loaded runs</span>
      </summary>
      <div className="drawer-body">
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
        {detail && (
          <ExecutionDetailPanel detail={detail} instanceUrl={instanceUrl} />
        )}
      </div>
    </details>
  );
}
