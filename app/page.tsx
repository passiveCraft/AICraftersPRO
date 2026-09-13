'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Moon, Pencil, Settings2, Sun } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ActivityPanel, ConnectionPanel, useN8n } from '@/components/n8n-panels';
import { WorkflowHome } from '@/components/workflow-home';
import { OfficeOverview } from '@/components/office-overview';
import { WorkflowStudio } from '@/components/workflow-studio';

type Route =
  | { kind: 'home' }
  | { kind: 'panel'; panel: 'connection' | 'activity' }
  | { kind: 'view'; workflowId: string }
  | { kind: 'edit'; workflowId: string }
  | { kind: 'new' };

function routeFromLocation(): Route {
  const params = new URLSearchParams(window.location.search);
  const panel = params.get('panel');
  const workflowId = params.get('workflow');
  if (panel === 'connection' || panel === 'activity') return { kind: 'panel', panel };
  if (params.get('new') === 'workflow') return { kind: 'new' };
  if (workflowId && params.get('mode') === 'edit') return { kind: 'edit', workflowId };
  if (workflowId) return { kind: 'view', workflowId };
  return { kind: 'home' };
}

function routeUrl(route: Route) {
  const url = new URL(window.location.href);
  url.search = '';
  if (route.kind === 'panel') url.searchParams.set('panel', route.panel);
  if (route.kind === 'view' || route.kind === 'edit') url.searchParams.set('workflow', route.workflowId);
  if (route.kind === 'edit') url.searchParams.set('mode', 'edit');
  if (route.kind === 'new') url.searchParams.set('new', 'workflow');
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function Home() {
  const n8n = useN8n();
  const [route, setRoute] = useState<Route>(() => typeof window === 'undefined' ? { kind: 'home' } : routeFromLocation());
  const [light, setLight] = useState(() => typeof window !== 'undefined' && localStorage.getItem('operator-theme') === 'light');

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigate(next: Route, replace = false) {
    if (replace) window.history.replaceState(null, '', routeUrl(next));
    else window.history.pushState(null, '', routeUrl(next));
    setRoute(next);
  }

  function toggleTheme() {
    setLight((value) => {
      localStorage.setItem('operator-theme', value ? 'dark' : 'light');
      return !value;
    });
  }

  const routedWorkflow = route.kind === 'view' || route.kind === 'edit'
    ? n8n.data.workflows.data.find((item) => item.id === route.workflowId)
    : undefined;

  useEffect(() => {
    if ((route.kind === 'view' || route.kind === 'edit') && !n8n.busy && !routedWorkflow) {
      window.history.replaceState(null, '', routeUrl({ kind: 'home' }));
    }
  }, [n8n.busy, route, routedWorkflow]);

  if (route.kind === 'new' || (route.kind === 'edit' && routedWorkflow)) {
    return (
      <WorkflowStudio
        workflow={route.kind === 'new' ? null : routedWorkflow!}
        instanceUrl={n8n.data.instanceUrl}
        onClose={() => navigate(route.kind === 'edit' ? { kind: 'view', workflowId: route.workflowId } : { kind: 'home' })}
        onChanged={n8n.refresh}
      />
    );
  }

  if (route.kind === 'view' && routedWorkflow) {
    const current = routedWorkflow;
    return (
      <main className={`office-shell ${light ? 'office-light' : ''}`}>
        <header className="office-topbar workflow-view-topbar">
          <button className="workflow-view-back" onClick={() => navigate({ kind: 'home' })} aria-label="Back to workflow library"><ArrowLeft size={18} /></button>
          <div className="office-compact-title"><span>Workflow view</span><strong>{current.name}</strong></div>
          <div className="office-head-actions workflow-view-actions">
            <button className="workflow-view-edit" onClick={() => navigate({ kind: 'edit', workflowId: current.id })}><Pencil size={15} /><span>Edit workflow</span></button>
            <button onClick={toggleTheme} aria-label={light ? 'Use dark mode' : 'Use light mode'}>{light ? <Moon size={16} /> : <Sun size={16} />}</button>
          </div>
        </header>
        <OfficeOverview
          workflows={[current]}
          executions={n8n.data.executions.data}
          connected={n8n.data.connected}
          light={light}
          onWorkflow={(workflow) => navigate({ kind: 'edit', workflowId: workflow.id })}
          onWorkflows={() => navigate({ kind: 'home' })}
          onCreate={() => navigate({ kind: 'new' })}
          onActivity={() => navigate({ kind: 'panel', panel: 'activity' })}
          onConnect={() => navigate({ kind: 'panel', panel: 'connection' })}
          onChanged={n8n.refresh}
        />
      </main>
    );
  }

  const panel = route.kind === 'panel' ? route.panel : null;
  return (
    <main className={`office-shell workflow-library-shell ${light ? 'office-light' : ''}`}>
      <div className="workflow-page-tools">
        <button onClick={toggleTheme} aria-label={light ? 'Use dark mode' : 'Use light mode'}>{light ? <Moon size={16} /> : <Sun size={16} />}</button>
        <button onClick={() => navigate({ kind: 'panel', panel: 'connection' })} aria-label="Connection settings"><Settings2 size={16} /></button>
      </div>
      <WorkflowHome
        workflows={n8n.data.workflows.data}
        executions={n8n.data.executions.data}
        connected={n8n.data.connected}
        onConnect={() => navigate({ kind: 'panel', panel: 'connection' })}
        onView={(workflow) => navigate({ kind: 'view', workflowId: workflow.id })}
        onEdit={(workflow) => navigate({ kind: 'edit', workflowId: workflow.id })}
        onCreate={() => navigate({ kind: 'new' })}
        onActivity={() => navigate({ kind: 'panel', panel: 'activity' })}
      />
      <Sheet open={panel !== null} onOpenChange={(open) => { if (!open) navigate({ kind: 'home' }); }}>
        <SheetContent className={`workspace-panel office-sheet ${panel === 'activity' && n8n.data.connected ? 'wide-panel' : ''}`}>
          <SheetHeader>
            <span className="eyebrow">OPERATOR / CORE</span>
            <SheetTitle>{panel === 'connection' ? 'n8n connection' : 'Run activity'}</SheetTitle>
            <SheetDescription>{panel === 'connection' ? 'Your account remains the source of truth.' : 'Diagnose recent n8n executions with their node output.'}</SheetDescription>
          </SheetHeader>
          {panel === 'connection' ? <ConnectionPanel state={n8n} /> : <ActivityPanel state={n8n} onConnect={() => navigate({ kind: 'panel', panel: 'connection' })} />}
          <div className="panel-footnote">
            <span className={`status-dot ${n8n.data.connected ? 'connected' : ''}`} />
            {n8n.data.connected ? 'Live from your n8n account' : 'No account connected'}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
