'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, KeyRound, RefreshCw, Search, Settings2, Sun, Moon, Workflow as WorkflowIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { ConnectionPanel, CredentialsPanel, useN8n } from './n8n-panels';
import { SystemMap } from './system-map';
import { SystemView } from './system-view';
import { WorkflowStudio } from './workflow-studio';
import type { Workflow } from '@/lib/n8n-types';

const hiddenWorkflowStorageKey = 'acp-hidden-workflows';

export function OperationsDashboard() {
  const n8n = useN8n();
  const [execution, setExecution] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [connection, setConnection] = useState(false);
  const [credentials, setCredentials] = useState(false);
  const [query, setQuery] = useState('');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [hiddenWorkflowIds, setHiddenWorkflowIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('acp-theme') === 'light' ? 'light' : 'dark';
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
      const savedHidden = JSON.parse(localStorage.getItem(hiddenWorkflowStorageKey) || '[]');
      if (Array.isArray(savedHidden)) setHiddenWorkflowIds(savedHidden.filter((id): id is string => typeof id === 'string'));
    } catch {}
  }, []);

  function setSelectedExecution(id: string | null, replace = false) {
    const url = new URL(location.href);
    if (id) url.searchParams.set('execution', id);
    else url.searchParams.delete('execution');
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
    setExecution(id);
  }

  function setWorkflowHidden(item: Workflow, hidden: boolean) {
    setHiddenWorkflowIds((current) => {
      const next = hidden ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id);
      try { localStorage.setItem(hiddenWorkflowStorageKey, JSON.stringify(next)); } catch {}
      return next;
    });
    if (hidden && workflow?.id === item.id) {
      setWorkflow(null);
      setSelectedExecution(null, true);
    }
  }

  const allWorkflows = n8n.data.workflows.data.filter((item) => !item.archived);
  const hiddenSet = new Set(hiddenWorkflowIds);
  const mapWorkflows = allWorkflows.filter((item) => !hiddenSet.has(item.id));
  const hiddenWorkflows = allWorkflows.filter((item) => hiddenSet.has(item.id));

  if (editingWorkflow) return <WorkflowStudio workflow={editingWorkflow} instanceUrl={n8n.data.instanceUrl} onClose={() => setEditingWorkflow(null)} onChanged={async () => { setEditingWorkflow(null); await n8n.refresh(); }} />;

  return (
    <main className={`hud-shell ${workflow ? 'system-detail-shell' : ''}`}>
      {!workflow && <header className="hud-header">
        <Link href="?" onClick={(event) => { event.preventDefault(); setWorkflow(null); setSelectedExecution(null); }}>
          <span className="brand-lockup"><Image src="/ai-crafters-pro-logo.png" alt="AI Crafters Pro" width={161} height={40} priority /><span className="light-brand" aria-hidden="true"><strong>AI Crafters</strong><span>PRO</span></span></span>
        </Link>
        <div className="header-location"><label className="hud-search"><Search size={17} /><input aria-label="Search systems" placeholder="Find a system" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
        <div className="header-actions">
          <button className="icon-button" aria-label="Refresh n8n" disabled={!!n8n.busy} onClick={() => void n8n.refresh()}><RefreshCw size={18} /></button>
          <button className="ghost-action" onClick={() => setConnection(true)}><Settings2 size={17} />{n8n.error ? 'Connection error' : n8n.busy === 'loading' ? 'Connecting…' : n8n.data.connected ? 'n8n connected' : 'Connect n8n'}</button>
          <button className="icon-button theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('acp-theme', next); } catch {} document.documentElement.dataset.theme = next; setTheme(next); }}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="icon-button credentials-trigger" aria-label="Open n8n credentials" title="Credentials" onClick={() => setCredentials(true)}><KeyRound size={18} /></button>
        </div>
      </header>}
      {n8n.error && <p className="hud-alert" role="alert">{n8n.error}</p>}
      {workflow ? <SystemView key={workflow.id} workflow={workflow} credentials={n8n.data.credentials} n8n={n8n} executionId={execution} onSelectExecution={setSelectedExecution} onBack={() => { setWorkflow(null); setSelectedExecution(null); }} onEditWorkflow={setEditingWorkflow} onHideFromMap={(item) => setWorkflowHidden(item, true)} /> : <>
        <SystemMap workflows={mapWorkflows} executions={n8n.data.executions.data} connected={n8n.data.connected} historyError={n8n.data.executionError} query={query} onSelectWorkflow={setWorkflow} />
        <footer className="activity-dock"><div><strong>{mapWorkflows.filter((item) => item.active).length}<small>/ {mapWorkflows.length}</small></strong><span>Active systems</span></div><div><strong>{n8n.data.executionError ? '—' : n8n.data.executions.data.filter((run) => ['running', 'new', 'waiting'].includes(run.status)).length}</strong><span>Running · loaded window</span></div><div><strong>{n8n.data.executionError ? '—' : n8n.data.executions.data.length}</strong><span>System runs loaded</span></div><div className="dock-note">{n8n.data.executionError ? 'History unavailable' : n8n.data.syncedAt ? `Updated ${new Date(n8n.data.syncedAt).toLocaleTimeString()}` : 'Awaiting connection'}</div></footer>
        <section className="hidden-workflows" aria-label="Hidden systems"><div className="hidden-workflows-heading"><div><span className="eyebrow">MAP VISIBILITY</span><h2>Hidden systems</h2></div><span>{hiddenWorkflows.length} hidden</span></div>{hiddenWorkflows.length ? <div className="hidden-workflow-list">{hiddenWorkflows.map((item) => <div className="hidden-workflow-row" key={item.id}><WorkflowIcon size={17} /><div><strong>{item.name}</strong><small>{item.active ? 'Active' : 'Paused'} · {item.nodes.length} steps</small></div><button className="ghost-action" onClick={() => setWorkflowHidden(item, false)}><Eye size={15} /> Show on map</button></div>)}</div> : <p>No systems are hidden from the map.</p>}</section>
      </>}
      <Sheet open={connection} onOpenChange={setConnection}><SheetContent className="acp-sheet"><SheetHeader><SheetTitle>n8n connection</SheetTitle><SheetDescription>Your workflows remain the source of truth.</SheetDescription></SheetHeader><ConnectionPanel state={n8n} /></SheetContent></Sheet>
      <Sheet open={credentials} onOpenChange={setCredentials}><SheetContent className="acp-sheet credentials-sheet"><SheetHeader><SheetTitle>n8n credentials</SheetTitle><SheetDescription>Connected accounts available to your n8n workflows.</SheetDescription></SheetHeader><CredentialsPanel state={n8n} onConnect={() => { setCredentials(false); setConnection(true); }} /></SheetContent></Sheet>
    </main>
  );
}
