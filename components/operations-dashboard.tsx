'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RefreshCw, Settings2, Search, Sun, Moon, Eye, EyeOff, Pencil, Workflow as WorkflowIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { ConnectionPanel, useN8n } from './n8n-panels';
import { SystemMap } from './system-map';
import { SystemView } from './system-view';
import { WorkflowStudio } from './workflow-studio';
import { mapSystems, unmatchedWorkflows } from '@/lib/ai-crafters';
import type { Workflow } from '@/lib/n8n-types';
const hiddenWorkflowStorageKey = 'acp-hidden-workflows';
export function OperationsDashboard() {
  const n8n = useN8n();
  const [system, setSystem] = useState<number | null>(null);
  const [execution, setExecution] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [connection, setConnection] = useState(false);
  const [query, setQuery] = useState('');
  const [hiddenWorkflowIds, setHiddenWorkflowIds] = useState<string[]>([]);
  const [workflowDetail, setWorkflowDetail] = useState<Workflow | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  useEffect(() => {
    const sync = () => {
      const p = new URLSearchParams(location.search);
      const n = Number(p.get('system'));
      setSystem(n >= 1 && n <= 10 ? n : null);
      setExecution(p.get('execution'));
    };
    queueMicrotask(sync);
    addEventListener('popstate', sync);
    queueMicrotask(() => {
      try {
        const savedTheme = localStorage.getItem('acp-theme') === 'light' ? 'light' : 'dark';
        setTheme(savedTheme);
        document.documentElement.dataset.theme = savedTheme;
        const savedHidden = JSON.parse(localStorage.getItem(hiddenWorkflowStorageKey) || '[]');
        if (Array.isArray(savedHidden)) setHiddenWorkflowIds(savedHidden.filter((id): id is string => typeof id === 'string'));
      } catch {}
    });
    return () => removeEventListener('popstate', sync);
  }, []);
  function navigate(
    n: number | null,
    id: string | null = null,
    replace = false,
  ) {
    const url = new URL(location.href);
    if (n) url.searchParams.set('system', String(n));
    else url.searchParams.delete('system');
    if (id) url.searchParams.set('execution', id);
    else url.searchParams.delete('execution');
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
    setSystem(n);
    setExecution(id);
  }
  const systems = mapSystems(n8n.data.workflows.data);
  const selected = systems.find((s) => s.number === system);
  const ids = new Set(
    systems.flatMap((s) => (s.workflow ? [s.workflow.id] : [])),
  );
  const runs = n8n.data.executions.data.filter((r) => ids.has(r.workflowId));
  const unmatched = unmatchedWorkflows(n8n.data.workflows.data);
  const hiddenSet = new Set(hiddenWorkflowIds);
  const visibleOtherWorkflows = unmatched.filter((workflow) => !hiddenSet.has(workflow.id));
  const hiddenWorkflows = n8n.data.workflows.data.filter((workflow) => !workflow.archived && hiddenSet.has(workflow.id));
  function setWorkflowHidden(workflow: Workflow, hidden: boolean) {
    setHiddenWorkflowIds((current) => {
      const next = hidden ? [...new Set([...current, workflow.id])] : current.filter((id) => id !== workflow.id);
      try { localStorage.setItem(hiddenWorkflowStorageKey, JSON.stringify(next)); } catch {}
      if (workflowDetail?.id === workflow.id) setWorkflowDetail(hidden ? null : workflow);
      return next;
    });
  }
  if (editingWorkflow) return <WorkflowStudio workflow={editingWorkflow} instanceUrl={n8n.data.instanceUrl} onClose={() => setEditingWorkflow(null)} onChanged={async () => { setEditingWorkflow(null); await n8n.refresh(); }} />;
  return (
    <main className="hud-shell">
      <header className="hud-header">
        <Link
          href="?"
          onClick={(e) => {
            e.preventDefault();
            navigate(null);
          }}
        >
          <span className="brand-lockup">
            <Image
              src="/ai-crafters-pro-logo.png"
              alt="AI Crafters Pro"
              width={161}
              height={40}
              priority
            />
            <span className="light-brand" aria-hidden="true"><strong>AI Crafters</strong><span>PRO</span></span>
          </span>
        </Link>
        <div className="header-location">
          <label className="hud-search">
            <Search size={17} />
            <input
              aria-label="Search Systems"
              placeholder="Find a System"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Refresh n8n"
            disabled={!!n8n.busy}
            onClick={() => void n8n.refresh()}
          >
            <RefreshCw size={18} />
          </button>
          <button className="ghost-action" onClick={() => setConnection(true)}>
            <Settings2 size={17} />
            {n8n.error
              ? 'Connection error'
              : n8n.busy === 'loading'
                ? 'Connecting…'
                : n8n.data.connected
                  ? 'n8n connected'
                  : 'Connect n8n'}
          </button>
          <button
            className="icon-button theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={theme === 'light'}
            onClick={() => {
              const nextTheme = theme === 'dark' ? 'light' : 'dark';
              try { localStorage.setItem('acp-theme', nextTheme); } catch {}
              document.documentElement.dataset.theme = nextTheme;
              setTheme(nextTheme);
            }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      {n8n.error && (
        <p className="hud-alert" role="alert">
          {n8n.error}
        </p>
      )}
      {selected?.workflow && !hiddenSet.has(selected.workflow.id) ? (
        <SystemView
          key={selected.workflow.id}
          workflow={selected.workflow}
          group={selected.group}
          n8n={n8n}
          executionId={execution}
          onSelectExecution={(id, replace) =>
            navigate(selected.number, id, replace)
          }
          onBack={() => navigate(null)}
          hiddenOnMap={hiddenSet.has(selected.workflow.id)}
          onToggleMapVisibility={() => { setWorkflowHidden(selected.workflow!, true); navigate(null); }}
        />
      ) : (
        <>
          {selected && (
            <p className="hud-alert">
              {selected.name}:{' '}
              {selected.duplicateIds.length
                ? 'Duplicate workflow names. Resolve them in n8n.'
                : 'Not connected. Use this exact workflow name in n8n.'}
              <button onClick={() => navigate(null)}>Dismiss</button>
            </p>
          )}
          <SystemMap
            systems={systems.filter((item) => !item.workflow || !hiddenSet.has(item.workflow.id))}
            executions={runs}
            connected={n8n.data.connected}
            historyError={n8n.data.executionError}
            query={query}
            onSelect={(n) => navigate(n)}
            otherWorkflows={visibleOtherWorkflows}
            onSelectWorkflow={setWorkflowDetail}
            hiddenWorkflowIds={hiddenWorkflowIds}
          />
          <footer className="activity-dock">
            <div>
              <strong>
                {systems.filter((s) => s.workflow?.active).length}
                <small>/ 10</small>
              </strong>
              <span>Active Systems</span>
            </div>
            <div>
              <strong>
                {n8n.data.executionError
                  ? '—'
                  : runs.filter((r) =>
                      ['running', 'new', 'waiting'].includes(r.status),
                    ).length}
              </strong>
              <span>Running · loaded window</span>
            </div>
            <div>
              <strong>{n8n.data.executionError ? '—' : runs.length}</strong>
              <span>Mapped runs loaded</span>
            </div>
            <div className="dock-note">
              {n8n.data.executionError
                ? 'History unavailable'
                : n8n.data.syncedAt
                  ? 'Updated ' +
                    new Date(n8n.data.syncedAt).toLocaleTimeString()
                  : 'Awaiting connection'}
            </div>
          </footer>
          <details className="connection-diagnostics">
            <summary>
              Connection diagnostics · {unmatched.length} unmatched workflows
            </summary>
            <p>All account workflows are loaded. Only exact-name, non-archived workflows appear on the System map.</p>
            {unmatched.length ? unmatched.map((w) => (
              <p key={w.id}>{w.name}</p>
            )) : <p>No unmatched workflows.</p>}
            {n8n.data.workflows.nextCursor && (
              <button
                disabled={!!n8n.busy}
                onClick={() => void n8n.loadMore('workflows')}
              >
                Load more workflows to complete mapping
              </button>
            )}
            {n8n.data.executionError && <p>{n8n.data.executionError}</p>}
          </details>
          {workflowDetail && <section className="workflow-detail-panel" aria-label="Workflow details">
            <div className="workflow-detail-heading"><div><span className="eyebrow">ACCOUNT WORKFLOW</span><h2>{workflowDetail.name}</h2></div><button className="icon-button" onClick={() => setWorkflowDetail(null)} aria-label="Close workflow details">×</button></div>
            <dl className="workflow-detail-facts"><div><dt>Status</dt><dd>{workflowDetail.active ? 'Active' : 'Paused'}</dd></div><div><dt>Steps</dt><dd>{workflowDetail.nodes.length}</dd></div><div><dt>Connections</dt><dd>{workflowDetail.edges.length}</dd></div></dl>
            <div className="workflow-detail-actions"><button className="primary-action" onClick={() => setEditingWorkflow(workflowDetail)}><Pencil size={15} /> Open editor</button><button className="ghost-action" onClick={() => setWorkflowHidden(workflowDetail, true)}><EyeOff size={15} /> Hide from map</button></div>
          </section>}
          <section className="hidden-workflows" aria-label="Hidden workflows">
            <div className="hidden-workflows-heading"><div><span className="eyebrow">MAP VISIBILITY</span><h2>Hidden workflows</h2></div><span>{hiddenWorkflows.length} hidden</span></div>
            {hiddenWorkflows.length ? <div className="hidden-workflow-list">{hiddenWorkflows.map((workflow) => <div className="hidden-workflow-row" key={workflow.id}><WorkflowIcon size={17} /><div><strong>{workflow.name}</strong><small>{workflow.active ? 'Active' : 'Paused'} · {workflow.nodes.length} steps</small></div><button className="ghost-action" onClick={() => setWorkflowHidden(workflow, false)}><Eye size={15} /> Show on map</button></div>)}</div> : <p>No workflows are hidden from the map.</p>}
          </section>
        </>
      )}
      <Sheet open={connection} onOpenChange={setConnection}>
        <SheetContent className="acp-sheet">
          <SheetHeader>
            <SheetTitle>n8n connection</SheetTitle>
            <SheetDescription>
              Your workflows remain the source of truth.
            </SheetDescription>
          </SheetHeader>
          <ConnectionPanel state={n8n} />
        </SheetContent>
      </Sheet>
    </main>
  );
}
