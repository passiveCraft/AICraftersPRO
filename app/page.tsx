'use client';

import { useEffect, useState } from 'react';
import { Moon, Settings2, Sparkles, Sun } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ActivityPanel, ConnectionPanel, GeminiPanel, WorkflowPanel, useN8n } from '@/components/n8n-panels';
import { OfficeOverview } from '@/components/office-overview';
import { WorkflowStudio } from '@/components/workflow-studio';
import type { Workflow } from '@/lib/n8n-types';

type Panel = 'connection' | 'workflows' | 'activity' | 'creations' | null;
export default function Home() {
  const n8n = useN8n();
  const [panel, setPanel] = useState<Panel>(null);
  const [light, setLight] = useState(false);
  const [studio, setStudio] = useState<Workflow | 'new' | null>(null);
  useEffect(() => {
    setLight(localStorage.getItem('operator-theme') === 'light');
  }, []);
  function toggleTheme() { setLight(value => { localStorage.setItem('operator-theme', value ? 'dark' : 'light'); return !value; }); }
  if (studio) return <WorkflowStudio workflow={studio === 'new' ? null : studio} instanceUrl={n8n.data.instanceUrl} onClose={() => setStudio(null)} onChanged={n8n.refresh} />;
  return <main className={`office-shell ${light ? 'office-light' : ''}`}>
    <header className="office-topbar">
      <div className="office-head-actions"><button onClick={() => setPanel('creations')} aria-label="Open Gemini creations" title="Gemini creations"><Sparkles size={16} /></button><button onClick={toggleTheme} aria-label={light ? 'Use dark mode' : 'Use light mode'} title={light ? 'Use dark mode' : 'Use light mode'}>{light ? <Moon size={16} /> : <Sun size={16} />}</button><button onClick={() => setPanel('connection')} aria-label="Connection settings" title="Connection settings"><Settings2 size={16} /></button></div>
      <div className="office-compact-title"><span>Workflows</span></div>
    </header>
    <OfficeOverview workflows={n8n.data.workflows.data} executions={n8n.data.executions.data} connected={n8n.data.connected} light={light} onConnect={() => setPanel('connection')} onWorkflow={setStudio} onWorkflows={() => setPanel('workflows')} onCreate={() => setStudio('new')} onActivity={() => setPanel('activity')} onCreations={() => setPanel('creations')} onChanged={n8n.refresh} />
    <Sheet open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }}><SheetContent className={`workspace-panel office-sheet ${panel !== 'connection' && n8n.data.connected ? 'wide-panel' : ''}`}><SheetHeader><span className="eyebrow">OPERATOR / CORE</span><SheetTitle>{panel === 'connection' ? 'n8n connection' : panel === 'workflows' ? 'Workflow library' : panel === 'creations' ? 'Gemini studio' : 'Run activity'}</SheetTitle><SheetDescription>{panel === 'connection' ? 'Your account remains the source of truth.' : panel === 'workflows' ? 'Open any workflow in the full-screen studio.' : panel === 'creations' ? 'Create, run, and review AI output without leaving this workspace.' : 'Diagnose recent n8n executions with their node output.'}</SheetDescription></SheetHeader>{panel === 'connection' ? <ConnectionPanel state={n8n} /> : panel === 'workflows' ? <WorkflowPanel state={n8n} onConnect={() => setPanel('connection')} onOpen={item => { setPanel(null); setStudio(item); }} onCreate={() => { setPanel(null); setStudio('new'); }} /> : panel === 'creations' ? <GeminiPanel state={n8n} onConnect={() => setPanel('connection')} /> : <ActivityPanel state={n8n} onConnect={() => setPanel('connection')} />}<div className="panel-footnote"><span className={`status-dot ${n8n.data.connected ? 'connected' : ''}`} />{n8n.data.connected ? 'Live from your n8n account' : 'No account connected'}</div></SheetContent></Sheet>
  </main>;
}
