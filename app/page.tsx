'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Link2,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Workflow as WorkflowIcon,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type View = 'overview' | 'workflows' | 'executions' | 'connection';
type WorkflowStatus = 'active' | 'inactive';
type ExecutionStatus = 'success' | 'running' | 'failed';

type N8nWorkflow = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  status: WorkflowStatus;
  lastRun: string;
  successRate: string;
};

type Execution = {
  id: string;
  workflowId: string;
  workflow: string;
  status: ExecutionStatus;
  started: string;
  duration: string;
  output: string;
};

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

const workflows: N8nWorkflow[] = [
  {
    id: 'wf_1284',
    name: 'Product research intake',
    description: 'Collects research requests and prepares the input for analysis.',
    trigger: 'Webhook',
    status: 'active',
    lastRun: '4 min ago',
    successRate: '99.2%',
  },
  {
    id: 'wf_2041',
    name: 'Review insights to brief',
    description: 'Turns approved research output into a structured creative brief.',
    trigger: 'Manual',
    status: 'active',
    lastRun: '18 min ago',
    successRate: '97.8%',
  },
  {
    id: 'wf_3348',
    name: 'UGC asset pipeline',
    description: 'Routes approved briefs through the existing production workflow.',
    trigger: 'Webhook',
    status: 'active',
    lastRun: '42 min ago',
    successRate: '98.4%',
  },
  {
    id: 'wf_4610',
    name: 'Inventory risk monitor',
    description: 'Checks inventory thresholds on the schedule configured in n8n.',
    trigger: 'Schedule',
    status: 'active',
    lastRun: '1 hr ago',
    successRate: '100%',
  },
  {
    id: 'wf_5902',
    name: 'Customer recovery flow',
    description: 'Runs the recovery sequence maintained by the operations team.',
    trigger: 'Webhook',
    status: 'inactive',
    lastRun: '3 days ago',
    successRate: '95.6%',
  },
];

const initialExecutions: Execution[] = [
  {
    id: 'ex_98214',
    workflowId: 'wf_1284',
    workflow: 'Product research intake',
    status: 'success',
    started: 'Today, 14:32',
    duration: '1.8s',
    output: 'Request accepted and normalized for the next workflow step.',
  },
  {
    id: 'ex_98213',
    workflowId: 'wf_2041',
    workflow: 'Review insights to brief',
    status: 'success',
    started: 'Today, 14:18',
    duration: '4.6s',
    output: 'Brief created with 6 required sections and sent for approval.',
  },
  {
    id: 'ex_98212',
    workflowId: 'wf_3348',
    workflow: 'UGC asset pipeline',
    status: 'running',
    started: 'Today, 14:09',
    duration: 'Running',
    output: 'Waiting for the existing n8n workflow to return its final output.',
  },
  {
    id: 'ex_98211',
    workflowId: 'wf_4610',
    workflow: 'Inventory risk monitor',
    status: 'failed',
    started: 'Today, 13:44',
    duration: '2.1s',
    output: 'The n8n execution returned an error. Open it in n8n for node-level debugging.',
  },
];

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'workflows', label: 'Workflows', icon: WorkflowIcon },
  { id: 'executions', label: 'Executions', icon: Activity },
  { id: 'connection', label: 'Connection', icon: Link2 },
];

function StatusBadge({ status }: { status: WorkflowStatus | ExecutionStatus }) {
  const Icon = status === 'success' ? CheckCircle2 : status === 'failed' ? XCircle : CircleDot;
  return (
    <span className={`status-badge ${status}`}>
      <Icon size={14} />
      {status}
    </span>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>('overview');
  const [connected, setConnected] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<N8nWorkflow>(workflows[0]);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [executions, setExecutions] = useState<Execution[]>(initialExecutions);
  const [query, setQuery] = useState('');
  const [instanceUrl, setInstanceUrl] = useState('https://your-workspace.app.n8n.cloud');
  const [apiKey, setApiKey] = useState('');
  const [payload, setPayload] = useState('{\n  "product": "Example product",\n  "market": "US"\n}');
  const [running, setRunning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');

  const filteredWorkflows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return workflows;
    return workflows.filter((workflow) =>
      `${workflow.name} ${workflow.description} ${workflow.trigger}`.toLowerCase().includes(value),
    );
  }, [query]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  function openRun(workflow: N8nWorkflow) {
    setSelectedWorkflow(workflow);
    setPayload('{\n  "product": "Example product",\n  "market": "US"\n}');
    setRunOpen(true);
  }

  function saveConnection() {
    if (!instanceUrl.trim() || apiKey.trim().length < 8) {
      showNotice('Enter an n8n URL and a valid API key.');
      return;
    }
    setConnected(true);
    setConnectionOpen(false);
    setApiKey('');
    showNotice('n8n account connected.');
  }

  function syncWorkflows() {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      showNotice('Workflow list synced from n8n.');
    }, 900);
  }

  function startRun() {
    if (!connected) {
      setRunOpen(false);
      setConnectionOpen(true);
      showNotice('Connect n8n before starting a workflow.');
      return;
    }

    try {
      JSON.parse(payload);
    } catch {
      showNotice('The input must be valid JSON.');
      return;
    }

    setRunning(true);
    window.setTimeout(() => {
      const execution: Execution = {
        id: `ex_${Math.floor(10000 + Math.random() * 89999)}`,
        workflowId: selectedWorkflow.id,
        workflow: selectedWorkflow.name,
        status: 'running',
        started: 'Just now',
        duration: 'Running',
        output: 'The execution request was handed to n8n. Results will appear here when it finishes.',
      };
      setExecutions((current) => [execution, ...current]);
      setRunning(false);
      setRunOpen(false);
      setSelectedExecution(execution);
      showNotice('Execution started in n8n.');
    }, 850);
  }

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext?.registerTool) return;

    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext['registerTool']>[0]) => {
      void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    };

    register({
      name: 'read_n8n_dashboard',
      title: 'Read n8n dashboard',
      description: 'Read the visible connection, workflow, and execution state without changing it.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({
        connected,
        view,
        workflowCount: workflows.length,
        executionCount: executions.length,
      }),
    });

    register({
      name: 'open_n8n_connection_setup',
      title: 'Open n8n connection setup',
      description: 'Open the visible form for connecting an n8n URL and API key. This does not save credentials.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => {
        setConnectionOpen(true);
        return { status: 'opened' };
      },
    });

    register({
      name: 'stage_n8n_workflow_run',
      title: 'Stage n8n workflow run',
      description: 'Open the visible run form for an existing n8n workflow. This does not start the execution.',
      inputSchema: {
        type: 'object',
        properties: { workflowId: { type: 'string', minLength: 1 } },
        required: ['workflowId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const workflowId = (input as { workflowId?: string })?.workflowId;
        const workflow = workflows.find((item) => item.id === workflowId);
        if (!workflow) throw new Error('Workflow not found.');
        openRun(workflow);
        return { status: 'staged', workflowId: workflow.id, workflowName: workflow.name };
      },
    });

    return () => lifecycle.abort();
  }, [connected, executions.length, view]);

  const activeExecutions = executions.filter((execution) => execution.status === 'running').length;
  const failures = executions.filter((execution) => execution.status === 'failed').length;

  return (
    <main className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon"><WorkflowIcon size={19} /></span>
          <div>
            <strong>Workflow Console</strong>
            <small>for n8n</small>
          </div>
        </div>

        <nav aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={view === item.id ? 'nav-button active' : 'nav-button'}
                key={item.id}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} />
                {item.label}
                {item.id === 'executions' && activeExecutions > 0 ? <b>{activeExecutions}</b> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-source">
          <div className="source-row">
            <span className={connected ? 'source-dot online' : 'source-dot'} />
            <div>
              <strong>{connected ? 'n8n connected' : 'Preview data'}</strong>
              <small>{connected ? instanceUrl.replace(/^https?:\/\//, '') : 'Connect your account to sync'}</small>
            </div>
          </div>
          <button onClick={() => setConnectionOpen(true)}>
            <Settings2 size={15} /> Connection settings
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={15} />
            <strong>{navItems.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button className="search-box" onClick={() => setView('workflows')}>
              <Search size={16} /> Search workflows
              <kbd>⌘ K</kbd>
            </button>
            <Button variant="outline" onClick={syncWorkflows} disabled={syncing}>
              <RefreshCw className={syncing ? 'spin' : ''} size={16} />
              {syncing ? 'Syncing' : 'Sync'}
            </Button>
            <Button onClick={() => setConnectionOpen(true)}>
              <Link2 size={16} /> {connected ? 'Connected' : 'Connect n8n'}
            </Button>
          </div>
        </header>

        <div className="content">
          {view === 'overview' ? (
            <>
              <PageHeading
                eyebrow="Operations"
                title="Workflow overview"
                description="Run and monitor workflows that already exist in your n8n account."
              />

              <section className="source-of-truth">
                <div className="source-mark"><WorkflowIcon size={20} /></div>
                <div>
                  <strong>n8n remains the source of truth</strong>
                  <p>Create, edit, debug, and manage credentials in n8n. This dashboard is the operator layer.</p>
                </div>
                <Button variant="outline" onClick={() => setConnectionOpen(true)}>
                  {connected ? 'Manage connection' : 'Connect account'}
                </Button>
              </section>

              <section className="metric-grid" aria-label="Workspace summary">
                <article>
                  <span>Active workflows</span>
                  <strong>{workflows.filter((workflow) => workflow.status === 'active').length}</strong>
                  <small>Synced from n8n</small>
                </article>
                <article>
                  <span>Executions today</span>
                  <strong>148</strong>
                  <small>Across all workflows</small>
                </article>
                <article>
                  <span>Success rate</span>
                  <strong>98.7%</strong>
                  <small>Last 24 hours</small>
                </article>
                <article className={failures ? 'attention' : ''}>
                  <span>Needs attention</span>
                  <strong>{failures}</strong>
                  <small>Open in n8n to debug</small>
                </article>
              </section>

              <div className="overview-grid">
                <section className="panel workflow-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Workflows</h2>
                      <p>Available from the connected account</p>
                    </div>
                    <button className="text-action" onClick={() => setView('workflows')}>View all <ArrowUpRight size={15} /></button>
                  </div>
                  <WorkflowTable items={workflows.slice(0, 4)} onRun={openRun} />
                </section>

                <section className="panel execution-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent executions</h2>
                      <p>Latest responses from n8n</p>
                    </div>
                  </div>
                  <div className="execution-list">
                    {executions.slice(0, 4).map((execution) => (
                      <button key={execution.id} onClick={() => setSelectedExecution(execution)}>
                        <span className={`execution-state ${execution.status}`} />
                        <div>
                          <strong>{execution.workflow}</strong>
                          <small>{execution.started} · {execution.duration}</small>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : null}

          {view === 'workflows' ? (
            <>
              <PageHeading
                eyebrow="n8n account"
                title="Workflows"
                description="A synced operational view. Workflow logic is edited only in n8n."
                action={<Button variant="outline"><ExternalLink size={16} /> Open n8n</Button>}
              />
              <section className="panel full-panel">
                <div className="list-toolbar">
                  <div className="workflow-search">
                    <Search size={16} />
                    <Input aria-label="Search workflows" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflows" />
                  </div>
                  <span>{filteredWorkflows.length} workflows</span>
                </div>
                <WorkflowTable items={filteredWorkflows} onRun={openRun} />
              </section>
            </>
          ) : null}

          {view === 'executions' ? (
            <>
              <PageHeading
                eyebrow="Activity"
                title="Executions"
                description="Execution status and returned output from the connected n8n workspace."
              />
              <section className="panel full-panel">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Execution</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((execution) => (
                      <TableRow key={execution.id} onClick={() => setSelectedExecution(execution)}>
                        <TableCell className="mono">{execution.id}</TableCell>
                        <TableCell><strong>{execution.workflow}</strong></TableCell>
                        <TableCell><StatusBadge status={execution.status} /></TableCell>
                        <TableCell>{execution.started}</TableCell>
                        <TableCell>{execution.duration}</TableCell>
                        <TableCell><ChevronRight size={16} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            </>
          ) : null}

          {view === 'connection' ? (
            <>
              <PageHeading
                eyebrow="Data source"
                title="n8n connection"
                description="Connect one n8n account. The dashboard will read workflows and execution data from it."
              />
              <div className="connection-grid">
                <section className="panel connection-card">
                  <div className="connection-title">
                    <span><Link2 size={19} /></span>
                    <div>
                      <h2>Account connection</h2>
                      <p>Use an API key created in your n8n account settings.</p>
                    </div>
                    <StatusBadge status={connected ? 'active' : 'inactive'} />
                  </div>
                  <div className="field-stack">
                    <label htmlFor="connection-url">n8n instance URL</label>
                    <Input id="connection-url" value={instanceUrl} onChange={(event) => setInstanceUrl(event.target.value)} />
                  </div>
                  <div className="field-stack">
                    <label htmlFor="connection-key">API key</label>
                    <div className="secret-field">
                      <KeyRound size={17} />
                      <Input id="connection-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste your n8n API key" />
                    </div>
                  </div>
                  <div className="security-note">
                    <CheckCircle2 size={17} />
                    <p>The production connection should store this key encrypted on the server. It should never be returned to the browser after saving.</p>
                  </div>
                  <div className="connection-actions">
                    <Button variant="outline" onClick={() => showNotice('Connection test ready for the backend integration.')}>Test connection</Button>
                    <Button onClick={saveConnection}>Save connection</Button>
                  </div>
                </section>

                <aside className="panel responsibility-card">
                  <h2>Clear responsibility</h2>
                  <div>
                    <span>n8n</span>
                    <strong>Builds and owns workflows</strong>
                    <p>Nodes, prompts, credentials, schedules, debugging, and workflow versions.</p>
                  </div>
                  <div>
                    <span>This dashboard</span>
                    <strong>Operates existing workflows</strong>
                    <p>Connection, discovery, run inputs, execution status, and returned outputs.</p>
                  </div>
                </aside>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <Dialog open={connectionOpen} onOpenChange={setConnectionOpen}>
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>Connect an n8n account</DialogTitle>
            <DialogDescription>The dashboard reads workflows through the n8n API. It does not create or edit them.</DialogDescription>
          </DialogHeader>
          <div className="dialog-fields">
            <div>
              <label htmlFor="dialog-url">Instance URL</label>
              <Input id="dialog-url" value={instanceUrl} onChange={(event) => setInstanceUrl(event.target.value)} />
            </div>
            <div>
              <label htmlFor="dialog-key">API key</label>
              <Input id="dialog-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="n8n API key" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectionOpen(false)}>Cancel</Button>
            <Button onClick={saveConnection}>Connect account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="app-dialog run-dialog">
          <DialogHeader>
            <DialogTitle>Run {selectedWorkflow.name}</DialogTitle>
            <DialogDescription>This sends one execution request to n8n. Workflow logic remains managed in n8n.</DialogDescription>
          </DialogHeader>
          <div className="run-summary-card">
            <span>Workflow ID</span><strong>{selectedWorkflow.id}</strong>
            <span>Trigger</span><strong>{selectedWorkflow.trigger}</strong>
          </div>
          <div className="field-stack">
            <label htmlFor="run-payload">Input payload</label>
            <Textarea id="run-payload" value={payload} onChange={(event) => setPayload(event.target.value)} rows={8} spellCheck={false} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>Cancel</Button>
            <Button onClick={startRun} disabled={running}>{running ? 'Starting…' : 'Run in n8n'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedExecution)} onOpenChange={(open) => !open && setSelectedExecution(null)}>
        <SheetContent className="execution-sheet">
          {selectedExecution ? (
            <>
              <SheetHeader>
                <SheetTitle>Execution details</SheetTitle>
                <SheetDescription>{selectedExecution.id} · received from n8n</SheetDescription>
              </SheetHeader>
              <div className="sheet-status">
                <StatusBadge status={selectedExecution.status} />
                <span>{selectedExecution.started}</span>
              </div>
              <div className="detail-section">
                <span>Workflow</span>
                <strong>{selectedExecution.workflow}</strong>
              </div>
              <div className="detail-section">
                <span>Duration</span>
                <strong>{selectedExecution.duration}</strong>
              </div>
              <div className="detail-section output-section">
                <span>Returned output</span>
                <p>{selectedExecution.output}</p>
              </div>
              <Button variant="outline" className="open-n8n-button"><ExternalLink size={16} /> Open execution in n8n</Button>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {notice ? <output className="toast">{notice}</output> : null}
    </main>
  );
}

function WorkflowTable({ items, onRun }: { items: N8nWorkflow[]; onRun: (workflow: N8nWorkflow) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workflow</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last run</TableHead>
          <TableHead>Success</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((workflow) => (
          <TableRow key={workflow.id}>
            <TableCell>
              <div className="workflow-name">
                <span><WorkflowIcon size={17} /></span>
                <div>
                  <strong>{workflow.name}</strong>
                  <small>{workflow.description}</small>
                </div>
              </div>
            </TableCell>
            <TableCell>{workflow.trigger}</TableCell>
            <TableCell><StatusBadge status={workflow.status} /></TableCell>
            <TableCell>{workflow.lastRun}</TableCell>
            <TableCell className="mono">{workflow.successRate}</TableCell>
            <TableCell>
              <Button size="sm" variant="outline" onClick={() => onRun(workflow)} disabled={workflow.status === 'inactive'}>
                <Play size={14} /> Run
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
