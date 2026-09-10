'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Moon, Network, Pause, Play, Settings2, Sun } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ActivityPanel, ConnectionPanel, WorkflowPanel, useN8n } from '@/components/n8n-panels';
import { OfficeOverview } from '@/components/office-overview';
import { WorkflowStudio } from '@/components/workflow-studio';
import type { Workflow } from '@/lib/n8n-types';

type Panel = 'connection' | 'workflows' | 'activity' | null;
export default function Home() {
  const n8n = useN8n();
  const [panel, setPanel] = useState<Panel>(null);
  const [paused, setPaused] = useState(false);
  const [light, setLight] = useState(false);
  const [clock, setClock] = useState('--:--');
  const [studio, setStudio] = useState<Workflow | 'new' | null>(null);
  useEffect(() => {
    if (localStorage.getItem('operator-theme') === 'light') setLight(true);
    const updateClock = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    updateClock(); const timer = window.setInterval(updateClock, 30000);
    return () => window.clearInterval(timer);
  }, []);
  function toggleTheme() { setLight(value => { localStorage.setItem('operator-theme', value ? 'dark' : 'light'); return !value; }); }
  if (studio) return <WorkflowStudio workflow={studio === 'new' ? null : studio} instanceUrl={n8n.data.instanceUrl} onClose={() => setStudio(null)} onChanged={n8n.refresh} />;
  return <main className={`office-shell ${light ? 'office-light' : ''}`}>
    <header className="office-topbar">
      <Link className="office-brand" href="/"><span>OPERATOR CORE</span><b>V4</b></Link>
      <div className="office-integrations"><span className={`status-dot ${n8n.data.connected ? 'connected' : ''}`} /> CONNECTED TO <i className="n8n-mark">n8n</i><span className="integration-pips"><i /><i /><i /><i /><i /><i /><i /><i /></span></div>
      <div className="office-head-actions"><span><span className={`status-dot ${n8n.data.connected ? 'connected' : ''}`} /> RUNS ON YOUR N8N</span><button onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume office motion' : 'Pause office motion'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button><button onClick={toggleTheme} aria-label={light ? 'Use dark mode' : 'Use light mode'}>{light ? <Moon size={15} /> : <Sun size={15} />}</button><button onClick={() => setPanel('connection')} aria-label="Connection settings"><Settings2 size={15} /></button><time>{clock}</time></div>
    </header>
    <OfficeOverview workflows={n8n.data.workflows.data} executions={n8n.data.executions.data} connected={n8n.data.connected} paused={paused} onWorkflow={setStudio} onWorkflows={() => setPanel('workflows')} onCreate={() => setStudio('new')} onActivity={() => setPanel('activity')} />
    <Sheet open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }}><SheetContent className={`workspace-panel office-sheet ${panel === 'workflows' && n8n.data.connected ? 'wide-panel' : ''}`}><SheetHeader><span className="eyebrow">OPERATOR / CORE</span><SheetTitle>{panel === 'connection' ? 'n8n connection' : panel === 'workflows' ? 'Workflow library' : 'Run activity'}</SheetTitle><SheetDescription>{panel === 'connection' ? 'Your account remains the source of truth.' : panel === 'workflows' ? 'Open any workflow in the full-screen studio.' : 'Recent execution history from n8n.'}</SheetDescription></SheetHeader>{panel === 'connection' ? <ConnectionPanel state={n8n} /> : panel === 'workflows' ? <WorkflowPanel state={n8n} onConnect={() => setPanel('connection')} onOpen={item => { setPanel(null); setStudio(item); }} onCreate={() => { setPanel(null); setStudio('new'); }} /> : <ActivityPanel state={n8n} onConnect={() => setPanel('connection')} />}<div className="panel-footnote"><span className={`status-dot ${n8n.data.connected ? 'connected' : ''}`} />{n8n.data.connected ? 'Live from your n8n account' : 'No account connected'}</div></SheetContent></Sheet>
  </main>;
}
