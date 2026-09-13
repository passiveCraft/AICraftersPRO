'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Box,
  Check,
  Clock3,
  Code2,
  GitBranch,
  Globe2,
  Network,
  Plus,
  Search,
  Webhook,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Execution, Workflow, WorkflowNode } from '@/lib/n8n-types';

type Props = {
  workflows: Workflow[];
  executions: Execution[];
  connected: boolean;
  onView: (workflow: Workflow) => void;
  onEdit: (workflow: Workflow) => void;
  onCreate: () => void;
  onActivity: () => void;
  onConnect: () => void;
};

function nodeIcon(node: WorkflowNode) {
  if (/gemini|agent|chat/i.test(node.type)) return Bot;
  if (/webhook/i.test(node.type)) return Webhook;
  if (/http/i.test(node.type)) return Globe2;
  if (/code/i.test(node.type)) return Code2;
  if (/schedule|trigger/i.test(node.type)) return Clock3;
  if (/if|switch/i.test(node.type)) return GitBranch;
  return Box;
}

function nodeLabel(node: WorkflowNode) {
  return (
    node.type
      .split('.')
      .at(-1)
      ?.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Step'
  );
}

function latestRun(executions: Execution[], workflowId: string) {
  return executions
    .filter((run) => run.workflowId === workflowId)
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))[0];
}

function timeLabel(value: string | null) {
  if (!value) return 'Never run';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return 'Unknown time';
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function WorkflowHome({
  workflows,
  executions,
  connected,
  onView,
  onEdit,
  onCreate,
  onActivity,
  onConnect,
}: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'issues'>('all');
  const visible = useMemo(
    () =>
      workflows.filter((workflow) => {
        const run = latestRun(executions, workflow.id);
        const matchesSearch = `${workflow.name} ${workflow.tags.join(' ')}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());
        const matchesFilter =
          filter === 'all'
            ? true
            : filter === 'active'
              ? workflow.active
              : !!run && ['error', 'crashed'].includes(run.status);
        return matchesSearch && matchesFilter;
      }),
    [executions, filter, search, workflows],
  );

  return (
    <div className="workflow-home">
      <header className="workflow-home-header">
        <div className="workflow-home-brand">
          <span>
            <WorkflowIcon size={19} />
          </span>
          <div>
            <strong>Operator Core</strong>
            <small>n8n workspace</small>
          </div>
        </div>
        <div className="workflow-home-actions">
          <button onClick={onActivity}>
            <Activity size={16} /> Activity
          </button>
          <button onClick={connected ? onCreate : onConnect}>
            <Plus size={17} />
            {connected ? 'New workflow' : 'Connect n8n'}
          </button>
        </div>
      </header>

      <section className="workflow-library-head">
        <div>
          <span>WORKFLOW LIBRARY</span>
          <h1>Your workflows</h1>
          <p>
            Open a workflow to inspect, edit, and run it in its own workspace.
          </p>
        </div>
        <dl>
          <div>
            <dt>Workflows</dt>
            <dd>{workflows.length}</dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd>{workflows.filter((item) => item.active).length}</dd>
          </div>
          <div>
            <dt>Needs attention</dt>
            <dd>
              {
                workflows.filter((item) => {
                  const run = latestRun(executions, item.id);
                  return run && ['error', 'crashed'].includes(run.status);
                }).length
              }
            </dd>
          </div>
        </dl>
      </section>

      <section className="workflow-library-tools" aria-label="Workflow filters">
        <div className="workflow-library-search">
          <Search size={17} />
          <Input
            aria-label="Search workflows"
            placeholder="Search workflows"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="workflow-library-filters">
          {(['all', 'active', 'issues'] as const).map((value) => (
            <button
              key={value}
              className={filter === value ? 'active' : ''}
              onClick={() => setFilter(value)}
            >
              {value === 'issues'
                ? 'Needs attention'
                : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {!connected ? (
        <section className="workflow-home-empty">
          <Network size={30} />
          <h2>Connect your n8n workspace</h2>
          <p>Your workflows will appear here as separate cards.</p>
          <button onClick={onConnect}>
            Connect n8n <ArrowRight size={16} />
          </button>
        </section>
      ) : !visible.length ? (
        <section className="workflow-home-empty">
          <Search size={27} />
          <h2>No matching workflows</h2>
          <p>Try another search or filter.</p>
        </section>
      ) : (
        <section className="workflow-card-list" aria-label="Workflows">
          {visible.map((workflow) => {
            const run = latestRun(executions, workflow.id);
            const failed = !!run && ['error', 'crashed'].includes(run.status);
            return (
              <article
                className={`workflow-card ${failed ? 'has-issue' : ''}`}
                key={workflow.id}
              >
                <button
                  className="workflow-card-main"
                  onClick={() => onView(workflow)}
                  aria-label={`View ${workflow.name}`}
                >
                  <div className="workflow-card-title">
                    <span className="workflow-card-icon">
                      <WorkflowIcon size={21} />
                    </span>
                    <div>
                      <span>
                        {workflow.active
                          ? 'ACTIVE WORKFLOW'
                          : 'INACTIVE WORKFLOW'}
                      </span>
                      <h2>{workflow.name}</h2>
                    </div>
                    <ArrowRight className="workflow-card-arrow" size={20} />
                  </div>
                  <div className="workflow-card-pipeline">
                    {workflow.nodes.slice(0, 5).map((node, index) => {
                      const Icon = nodeIcon(node);
                      return (
                        <div className="workflow-card-node" key={node.id}>
                          <span>
                            <Icon size={17} />
                          </span>
                          <div>
                            <strong>{node.name}</strong>
                            <small>{nodeLabel(node)}</small>
                          </div>
                          {index < Math.min(workflow.nodes.length, 5) - 1 && (
                            <i />
                          )}
                        </div>
                      );
                    })}
                    {workflow.nodes.length > 5 && (
                      <div className="workflow-card-more">
                        +{workflow.nodes.length - 5}
                      </div>
                    )}
                  </div>
                </button>
                <footer className="workflow-card-footer">
                  <div
                    className={`workflow-run-health ${failed ? 'failed' : run?.status === 'success' ? 'success' : ''}`}
                  >
                    {failed ? (
                      <AlertTriangle size={15} />
                    ) : run?.status === 'success' ? (
                      <Check size={15} />
                    ) : (
                      <Clock3 size={15} />
                    )}
                    <span>
                      {failed
                        ? 'Needs attention'
                        : run?.status === 'success'
                          ? 'Last run succeeded'
                          : run
                            ? `Last run · ${run.status}`
                            : 'No executions yet'}
                    </span>
                  </div>
                  <span>{timeLabel(run?.startedAt || null)}</span>
                  <span>{workflow.nodes.length} steps</span>
                  <div className="workflow-card-actions">
                    <button onClick={() => onEdit(workflow)}>Edit workflow</button>
                    <button onClick={() => onView(workflow)}>
                      View workflow <ArrowRight size={14} />
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
