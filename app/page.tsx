'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, Boxes, Check, ChevronDown, CircleDot,
  Compass, Download, FileJson, FileStack, FlaskConical, Gauge, LayoutGrid,
  MessageSquareText, PackagePlus, Play, Radio, RefreshCw, Search, Send,
  Settings2, ShieldCheck, Sparkles, Target, UserCheck, Workflow,
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { productDiscoveryPack, type SystemAgent, type SystemArtifact } from '@/lib/system-packs';

type View = 'Cockpit' | 'Runs' | 'Artifacts' | 'Approvals' | 'Learn & build';
type Message = { author: 'operator' | 'founder'; text: string };
type ToolInput = Record<string, unknown>;
type ModelContext = { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> };

const stageThresholds = [8, 25, 40, 55, 76, 92, 100];

const runRows = [
  { id: '#04', brief: 'Magnetic desk cable kit', state: 'Running', outcome: 'Offer ranking', duration: '06:42', cost: '$0.42' },
  { id: '#03', brief: 'Compact plant grow-light', state: 'Stopped', outcome: 'Weak validation', duration: '18:19', cost: '$1.18' },
  { id: '#02', brief: 'Weighted sleep eye mask', state: 'Completed', outcome: 'Greenlit', duration: '21:06', cost: '$1.34' },
  { id: '#01', brief: 'Travel jewelry organizer', state: 'Completed', outcome: 'Revise offer', duration: '19:47', cost: '$1.09' },
];

const activitySeed = [
  { time: '16:32', agent: 'Competitor Scan', text: 'Mapped 9 comparable offers between $24 and $68.' },
  { time: '16:31', agent: 'Pain Miner', text: 'Found 27 recurring complaints across reviews and community threads.' },
  { time: '16:29', agent: 'Demand Signal', text: 'Confirmed 12 rising search patterns in the target category.' },
];

export default function Home() {
  const pack = productDiscoveryPack;
  const [view, setView] = useState<View>('Cockpit');
  const [demoMode, setDemoMode] = useState(true);
  const [progress, setProgress] = useState(68);
  const [runActive, setRunActive] = useState(true);
  const [runName, setRunName] = useState('Magnetic desk cable kit');
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('Premium desk organization');
  const [newMarket, setNewMarket] = useState('United States');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { author: 'operator', text: 'I am following run #04. Ask about the evidence, compare the offers, or control the demo.' },
  ]);

  const activeIndex = stageThresholds.findIndex((threshold) => progress <= threshold);
  const displayAgents = pack.agents.map((agent, index) => ({
    ...agent,
    state: index < activeIndex ? 'completed' : index === activeIndex ? 'working' : 'waiting',
  } satisfies SystemAgent));
  const activeAgent = displayAgents[Math.max(0, activeIndex)] ?? displayAgents[displayAgents.length - 1];
  const selectedAgent = displayAgents.find((agent) => agent.id === selectedAgentId) ?? null;
  const selectedArtifact = pack.artifacts.find((artifact) => artifact.id === artifactId) ?? null;
  const runSnapshot = useRef({ progress, runName, activeAgent: activeAgent.name, mode: demoMode ? 'demo' : 'live' });

  useEffect(() => {
    runSnapshot.current = { progress, runName, activeAgent: activeAgent.name, mode: demoMode ? 'demo' : 'live' };
  }, [activeAgent.name, demoMode, progress, runName]);

  useEffect(() => {
    if (!runActive || progress >= 74) return;
    const timer = window.setInterval(() => setProgress((value) => Math.min(value + 1, 74)), 2200);
    return () => window.clearInterval(timer);
  }, [progress, runActive]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: 'start_product_discovery_demo',
        title: 'Start product discovery demo',
        description: 'Start a visible Product Discovery demo run using a product category and target market.',
        inputSchema: {
          type: 'object',
          properties: { category: { type: 'string', minLength: 3 }, market: { type: 'string', minLength: 2 } },
          required: ['category', 'market'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input: ToolInput) {
          if (typeof input.category !== 'string' || input.category.trim().length < 3 || typeof input.market !== 'string' || input.market.trim().length < 2) {
            throw new Error('Category and market are required.');
          }
          setRunName(input.category.trim()); setNewCategory(input.category.trim()); setNewMarket(input.market.trim());
          setProgress(4); setRunActive(true); setView('Cockpit'); setNotice('New demo run started');
          return { status: 'started', system: pack.id, category: input.category.trim(), market: input.market.trim() };
        },
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: 'read_current_run',
        title: 'Read current run',
        description: 'Read the visible demo run status without changing the dashboard.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute() { return runSnapshot.current; },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [pack.id]);

  function startRun() {
    setRunName(newCategory || 'Untitled discovery brief'); setProgress(4); setRunActive(true);
    setApproved(false); setView('Cockpit'); setNewRunOpen(false); setNotice('Demo run started');
    window.setTimeout(() => setNotice(null), 2600);
  }

  function sendMessage(prompt?: string) {
    const value = (prompt ?? chatInput).trim();
    if (!value) return;
    setMessages((items) => [...items, { author: 'founder', text: value }, { author: 'operator', text: operatorReply(value, activeAgent.name) }]);
    setChatInput('');
  }

  function approveOffer() {
    setApproved(true); setProgress(82); setRunActive(true); setApprovalOpen(false); setView('Cockpit');
    setNotice('Top offer approved · Validator started');
    window.setTimeout(() => setNotice(null), 3000);
  }

  const navItems: { label: View; icon: typeof Gauge; count?: number }[] = [
    { label: 'Cockpit', icon: Gauge }, { label: 'Runs', icon: Activity },
    { label: 'Artifacts', icon: FileStack }, { label: 'Approvals', icon: UserCheck, count: approved ? 0 : 1 },
    { label: 'Learn & build', icon: Compass },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><span className="brand-orbit"><span /></span><div><strong>Operator Core</strong><small>AI commerce systems</small></div></div>
        <nav aria-label="Primary navigation" className="primary-nav">
          <p className="eyebrow">Workspace</p>
          {navItems.map((item) => { const Icon = item.icon; return (
            <button className={view === item.label ? 'nav-item active' : 'nav-item'} key={item.label} onClick={() => setView(item.label)}>
              <Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.count ? <b>{item.count}</b> : null}
            </button>
          ); })}
        </nav>
        <div className="systems-block">
          <div className="systems-heading"><p className="eyebrow">Installed systems</p><button aria-label="Open system list"><ChevronDown size={15} /></button></div>
          <button className="system-item selected" onClick={() => setView('Cockpit')}><span className="system-number">01</span><span><strong>Product discovery</strong><small>7 agents · ready</small></span></button>
          <button className="system-item" onClick={() => setNotice('Creative Production pack preview')}><span className="system-number muted">03</span><span><strong>Creative production</strong><small>Pack available</small></span></button>
          <button className="system-item dimmed" onClick={() => setView('Learn & build')}><span className="system-number muted">+</span><span><strong>Add system pack</strong><small>No demo limit</small></span></button>
        </div>
        <div className="sidebar-foot"><div className={demoMode ? 'connection-dot' : 'connection-dot offline'} /><div><strong>{demoMode ? 'Demo environment' : 'Live environment'}</strong><small>{demoMode ? 'n8n connection not required' : 'Connect your n8n instance'}</small></div><Settings2 size={16} /></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><LayoutGrid size={15} /><span>Systems</span><i>/</i><strong>{view}</strong></div>
          <div className="topbar-actions">
            <label className="mode-switch"><span>{demoMode ? 'Demo mode' : 'Live mode'}</span><Switch checked={demoMode} onCheckedChange={setDemoMode} aria-label="Toggle demo mode" /></label>
            <button className="icon-button" aria-label="Search"><Search size={18} /></button>
            <Button className="run-button" onClick={() => setNewRunOpen(true)}><Play size={15} fill="currentColor" /> New run</Button>
          </div>
        </header>
        <div className="workspace-scroll">
          {view === 'Cockpit' ? <Cockpit pack={pack} agents={displayAgents} activeAgent={activeAgent} progress={progress} runName={runName} onAgent={setSelectedAgentId} onArtifact={setArtifactId} onApproval={() => setApprovalOpen(true)} /> : null}
          {view === 'Runs' ? <RunsView /> : null}
          {view === 'Artifacts' ? <ArtifactsView artifacts={pack.artifacts} onArtifact={setArtifactId} /> : null}
          {view === 'Approvals' ? <ApprovalsView approved={approved} onReview={() => setApprovalOpen(true)} /> : null}
          {view === 'Learn & build' ? <LearnView /> : null}
        </div>
      </section>

      <ActivityPanel activeAgent={activeAgent} progress={progress} onApproval={() => setApprovalOpen(true)} onChat={() => setChatOpen(true)} />
      {notice ? <div className="toast-notice"><Check size={16} />{notice}</div> : null}

      <Dialog open={newRunOpen} onOpenChange={setNewRunOpen}>
        <DialogContent className="operator-dialog sm:max-w-[560px]">
          <DialogHeader><DialogTitle>Start a product discovery run</DialogTitle><DialogDescription>Give the AI team a focused category and market. Demo Mode uses the included evidence set.</DialogDescription></DialogHeader>
          <div className="form-grid"><div><label htmlFor="product-category">Product category</label><Input id="product-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /></div><div><label htmlFor="target-market">Target market</label><Input id="target-market" value={newMarket} onChange={(event) => setNewMarket(event.target.value)} /></div><div className="full"><label htmlFor="optimization-brief">What should the team optimize for?</label><Textarea id="optimization-brief" defaultValue="Find a painful, visually demonstrable problem with strong gross-margin potential. Avoid fragile or regulated products." /></div></div>
          <div className="safe-run-note"><ShieldCheck size={17} /><span><strong>Safe demo run</strong><small>No external calls, publishing, or ad spend.</small></span></div>
          <DialogFooter><Button variant="secondary" onClick={() => setNewRunOpen(false)}>Cancel</Button><Button className="run-button" onClick={startRun}><Play size={14} fill="currentColor" /> Start team</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedAgent)} onOpenChange={(open) => !open && setSelectedAgentId(null)}>
        <SheetContent className="operator-sheet sm:max-w-[470px]">
          {selectedAgent ? <><SheetHeader><div className={`agent-sheet-icon ${selectedAgent.state}`}><Sparkles size={19} /></div><SheetTitle>{selectedAgent.name}</SheetTitle><SheetDescription>{selectedAgent.role}</SheetDescription></SheetHeader>
            <Tabs defaultValue="work" className="agent-tabs"><TabsList><TabsTrigger value="work">Work</TabsTrigger><TabsTrigger value="evidence">Evidence</TabsTrigger></TabsList><TabsContent value="work"><DetailBlock label="Input" value={selectedAgent.input} /><DetailBlock label="Latest output" value={selectedAgent.output} /><div className="agent-health"><span><i /> Healthy</span><span>{selectedAgent.state.replace('_', ' ')}</span></div></TabsContent><TabsContent value="evidence"><ul className="evidence-list">{selectedAgent.evidence.map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul></TabsContent></Tabs>
            <Button className="sheet-chat" onClick={() => { setSelectedAgentId(null); setChatOpen(true); }}><MessageSquareText size={16} /> Ask Operator about this agent</Button></> : null}
        </SheetContent>
      </Sheet>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent className="operator-sheet chat-sheet sm:max-w-[500px]"><SheetHeader><div className="agent-sheet-icon working"><MessageSquareText size={19} /></div><SheetTitle>Operator</SheetTitle><SheetDescription>Understands this system, its evidence, and supported controls.</SheetDescription></SheetHeader>
          <div className="quick-prompts"><button onClick={() => sendMessage('What is the strongest evidence?')}>Strongest evidence</button><button onClick={() => sendMessage('Compare the three offers')}>Compare offers</button><button onClick={() => sendMessage('What needs my approval?')}>What needs approval?</button></div>
          <div className="chat-messages">{messages.map((message, index) => <div className={`chat-message ${message.author}`} key={`${message.author}-${index}`}><small>{message.author === 'operator' ? 'Operator' : 'You'}</small><p>{message.text}</p></div>)}</div>
          <div className="chat-composer"><Textarea placeholder="Ask about the run or propose a safe change…" value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} /><Button aria-label="Send message" onClick={() => sendMessage()}><Send size={16} /></Button></div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(selectedArtifact)} onOpenChange={(open) => !open && setArtifactId(null)}><DialogContent className="operator-dialog sm:max-w-[620px]">{selectedArtifact ? <ArtifactDetail artifact={selectedArtifact} /> : null}</DialogContent></Dialog>

      <AlertDialog open={approvalOpen} onOpenChange={setApprovalOpen}><AlertDialogContent className="operator-dialog approval-dialog"><AlertDialogHeader><div className="approval-badge"><UserCheck size={18} /> Founder decision</div><AlertDialogTitle>Approve the top offer for validation?</AlertDialogTitle><AlertDialogDescription>The team recommends a magnetic mixed-size cable kit with a replacement guarantee. This authorizes only the disposable presale test.</AlertDialogDescription></AlertDialogHeader>
        <div className="approval-option"><div><strong>Magnetic Cable System — Pro Kit</strong><p>Six mixed-size anchors, tool-free magnetic routing, and a two-year replacement promise.</p></div><span>0.84 confidence</span><ul><li>Strongest recurring pain</li><li>74% modeled gross margin</li><li>Clear visual demonstration</li></ul></div>
        <div className="approval-scope"><ShieldCheck size={16} /><span>Creates a test page and draft ads. Spend remains capped at $75 and nothing publishes without the next approval.</span></div>
        <AlertDialogFooter><AlertDialogCancel>Send back</AlertDialogCancel><AlertDialogAction className="run-button" onClick={approveOffer}>Approve validation <ArrowRight size={15} /></AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}

function Cockpit({ pack, agents, activeAgent, progress, runName, onAgent, onArtifact, onApproval }: { pack: typeof productDiscoveryPack; agents: SystemAgent[]; activeAgent: SystemAgent; progress: number; runName: string; onAgent: (id: string) => void; onArtifact: (id: string) => void; onApproval: () => void }) {
  const completed = agents.filter((agent) => agent.state === 'completed').length;
  return <><section className="system-intro"><div><p className="eyebrow accent">System {pack.number} · {pack.module}</p><h1>{pack.title}</h1><p>{pack.outcome}</p></div><div className="run-summary"><div><small>Current run</small><strong>#04 · {runName}</strong></div><div className="summary-metric"><small>Signal quality</small><strong>84<span>/100</span></strong></div><div className="summary-metric"><small>Est. spend</small><strong>$0.42</strong></div></div></section>
    <section className="map-card"><div className="map-toolbar"><div><span className="live-pill"><Radio size={12} /> Run active</span><span>{completed} agents complete · 37 signals retained</span></div><div className="progress-label"><span>{progress}%</span><Progress value={progress} /></div></div>
      <div className="agent-map"><svg aria-hidden="true" viewBox="0 0 1000 430" preserveAspectRatio="none"><path className="path-base" d="M78 282 C150 270 170 185 240 198 S325 270 395 248 S490 125 555 165 S645 255 706 227 S792 105 856 147 S895 267 928 286" /><path className="path-live" style={{ strokeDashoffset: Math.max(0, 95 - progress) }} d="M78 282 C150 270 170 185 240 198 S325 270 395 248 S490 125 555 165 S645 255 706 227" /></svg>
        <div className="core-brain" aria-label="Operator core is coordinating the run"><div className="core-ring ring-one" /><div className="core-ring ring-two" /><span><Sparkles size={20} /><small>Core</small></span></div>
        {agents.map((agent, index) => <button className={`agent-node ${agent.state === 'completed' ? 'done' : agent.state}`} key={agent.id} style={{ left: `${agent.x}%`, top: `${agent.y}%` }} onClick={() => onAgent(agent.id)} aria-label={`${agent.name}: ${agent.state}`}><span className="node-disc">{agent.state === 'completed' ? <Check size={17} /> : agent.state === 'working' ? <Sparkles size={17} /> : index === 6 ? <UserCheck size={17} /> : <CircleDot size={17} />}</span><span className="node-copy"><strong>{agent.name}</strong><small>{agent.role}</small></span></button>)}
        <div className="working-card"><div className="working-card-head"><span><Sparkles size={15} /> Working now</span><small>{progress < 20 ? '00:08' : '00:42'}</small></div><h2>{activeAgent.name}</h2><p>{activeAgent.output}</p><div className="signal-chips">{activeAgent.evidence.map((item) => <span key={item}>{item}</span>)}</div></div>
      </div>
      <div className="artifact-strip"><div className="artifact-label"><Boxes size={17} /><span><strong>Live outputs</strong><small>Built as the team works</small></span></div>{pack.artifacts.slice(0,3).map((artifact) => <button className={artifact.status === 'building' ? 'building' : ''} key={artifact.id} onClick={() => onArtifact(artifact.id)}><span className={`artifact-icon ${artifact.id === 'signals' ? 'blue' : artifact.id === 'pains' ? 'amber' : 'mint'}`}>{artifact.id === 'signals' ? <Radio size={16} /> : artifact.id === 'pains' ? <Target size={16} /> : <FlaskConical size={16} />}</span><span><strong>{artifact.title}</strong><small>{artifact.metric}</small></span>{artifact.status === 'building' ? <span className="mini-loader" /> : <ArrowUpRight size={15} />}</button>)}</div>
    </section><button className="mobile-approval" onClick={onApproval}><UserCheck size={16} /> Review founder decision</button></>;
}

function RunsView() { return <section className="secondary-view"><ViewHeading eyebrow="Execution history" title="Runs" description="See what happened, what it cost, and what the team decided." action={<Button><RefreshCw size={15} /> Refresh</Button>} /><div className="runs-table"><div className="runs-row runs-head"><span>Run</span><span>Brief</span><span>Status</span><span>Outcome</span><span>Duration</span><span>Cost</span></div>{runRows.map((run) => <div className="runs-row" key={run.id}><strong>{run.id}</strong><span>{run.brief}</span><span><i className={`status-dot ${run.state.toLowerCase()}`} />{run.state}</span><span>{run.outcome}</span><span>{run.duration}</span><span>{run.cost}</span></div>)}</div></section>; }

function ArtifactsView({ artifacts, onArtifact }: { artifacts: SystemArtifact[]; onArtifact: (id: string) => void }) { return <section className="secondary-view"><ViewHeading eyebrow="Reusable work" title="Artifacts" description="Every useful output, tied back to its evidence and creating agent." /><div className="artifact-grid">{artifacts.map((artifact, index) => <button key={artifact.id} onClick={() => onArtifact(artifact.id)}><div className={`artifact-preview preview-${index}`}><span>{artifact.kind}</span><strong>{artifact.metric}</strong></div><div><p>{artifact.title}</p><small>{artifact.summary}</small></div><ArrowUpRight size={16} /></button>)}</div></section>; }

function ApprovalsView({ approved, onReview }: { approved: boolean; onReview: () => void }) { return <section className="secondary-view"><ViewHeading eyebrow="Human control" title="Approvals" description="Nothing consequential moves forward without a clear founder decision." /><div className={approved ? 'approval-page-card approved' : 'approval-page-card'}><div className="approval-page-icon">{approved ? <Check size={22} /> : <UserCheck size={22} />}</div><div><span>{approved ? 'Decision recorded' : 'Ready for review'}</span><h2>{approved ? 'Magnetic Cable System approved' : 'Choose the offer to validate'}</h2><p>{approved ? 'The Validator is now building the disposable presale test.' : 'Three concepts are ranked. The recommendation is backed by demand, pain, competitive, and margin evidence.'}</p><div className="approval-facts"><span><small>Top confidence</small><strong>0.84</strong></span><span><small>Spend authorized</small><strong>$75 max</strong></span><span><small>Publishing</small><strong>Still blocked</strong></span></div></div>{!approved ? <Button className="run-button" onClick={onReview}>Review decision <ArrowRight size={15} /></Button> : null}</div></section>; }

function LearnView() { return <section className="secondary-view"><ViewHeading eyebrow="Build the system" title="Learn & download" description="The exact assets behind this demo—and a pack format that supports every future system." action={<Button><PackagePlus size={15} /> Install another pack</Button>} /><div className="learn-layout"><div className="resource-list">{productDiscoveryPack.resources.map((resource) => <button key={resource.name}><span className="file-type">{resource.type}</span><div><strong>{resource.name}</strong><small>{resource.detail}</small></div><Download size={16} /></button>)}</div><aside className="pack-contract"><div className="contract-icon"><FileJson size={21} /></div><p className="eyebrow accent">System-pack contract</p><h2>Add the next demo without rebuilding the dashboard.</h2><p>Each pack supplies its agents, business stages, inputs, editable settings, artifacts, approvals, metrics, n8n workflows, and learning resources.</p><ul><li><Check size={14} /> No fixed demo limit</li><li><Check size={14} /> Shared interaction and motion language</li><li><Check size={14} /> Pack-level version checking</li></ul><Button variant="secondary"><Workflow size={15} /> View pack structure</Button></aside></div></section>; }

function ActivityPanel({ activeAgent, progress, onApproval, onChat }: { activeAgent: SystemAgent; progress: number; onApproval: () => void; onChat: () => void }) { return <aside className="activity-panel"><div className="activity-head"><div><p className="eyebrow">Live activity</p><strong>Run #04</strong></div><span className="streaming"><i /> Streaming</span></div><button className="decision-card" onClick={onApproval}><div className="decision-icon"><UserCheck size={18} /></div><div><p>Decision approaching</p><strong>Offer review at 76%</strong><small>You will review the evidence before the validation test is built.</small></div></button><div className="timeline"><article className="current"><i /><time>Now</time><div><strong>{activeAgent.name}</strong><p>{activeAgent.output}</p></div></article>{activitySeed.map((item) => <article key={item.time}><i /><time>{item.time}</time><div><strong>{item.agent}</strong><p>{item.text}</p></div></article>)}</div><div className="run-mini-progress"><span>Run progress</span><strong>{progress}%</strong><Progress value={progress} /></div><button className="jarvis-entry" onClick={onChat}><span><MessageSquareText size={18} /></span><div><strong>Ask Operator</strong><small>Inspect, explain, or control this run</small></div><ArrowUpRight size={16} /></button></aside>; }

function ViewHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <header className="view-heading"><div><p className="eyebrow accent">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</header>; }
function DetailBlock({ label, value }: { label: string; value: string }) { return <div className="detail-block"><small>{label}</small><p>{value}</p></div>; }
function ArtifactDetail({ artifact }: { artifact: SystemArtifact }) { return <><DialogHeader><div className="artifact-dialog-title"><span className="artifact-icon mint"><FlaskConical size={17} /></span><div><DialogTitle>{artifact.title}</DialogTitle><DialogDescription>{artifact.summary}</DialogDescription></div></div></DialogHeader><div className="artifact-detail-metric"><small>Current result</small><strong>{artifact.metric}</strong></div><div className="artifact-evidence"><p className="eyebrow">Evidence included</p><ul><li><Check size={14} /> Source links and capture timestamps</li><li><Check size={14} /> Creating agent and instruction version</li><li><Check size={14} /> Confidence, limitations, and recommended next action</li></ul></div><DialogFooter><Button variant="secondary"><Download size={15} /> Export</Button><Button className="run-button">Open full artifact <ArrowUpRight size={15} /></Button></DialogFooter></>; }
function operatorReply(value: string, activeAgent: string) { const lower = value.toLowerCase(); if (lower.includes('strongest')) return 'The strongest evidence is the repeated cable-slip complaint paired with rising “magnetic cable holder” demand. It appears across both reviews and community threads, not a single source.'; if (lower.includes('compare')) return 'The mixed-size magnetic kit leads because it solves the broadest verified pain and supports a 74% modeled margin. The grow-light concept has demand but weaker conversion evidence; the eye mask is viable but less differentiated.'; if (lower.includes('approval')) return 'Your next decision authorizes the Validator to build a disposable presale page and draft ad test. Spend is capped at $75, and publishing remains blocked.'; return `${activeAgent} is the active stage. I can explain its evidence, compare outputs, or propose a safe setting change for review.`; }
