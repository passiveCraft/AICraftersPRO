'use client';
import { createElement } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  LoaderCircle,
  X,
  Clock3,
  ExternalLink,
  Webhook,
  Globe2,
  GitBranch,
  Box,
  Pencil,
} from 'lucide-react';
import { agentRunState, type AgentRunState } from '@/lib/ai-crafters';
import { ExecutionDataView } from './execution-data-view';
import type {
  ApprovalAction,
  ExecutionDetail,
  Workflow,
  WorkflowNode,
} from '@/lib/n8n-types';
function formatDuration(value: number | null) {
  return value === null
    ? 'Unavailable'
    : value < 1000
      ? value + 'ms'
      : (value / 1000).toFixed(1) + 's';
}
function cleanType(type: string) {
  return type.split('.').at(-1) || type;
}
function iconFor(node: WorkflowNode) {
  if (/webhook/i.test(node.type)) return Webhook;
  if (/http/i.test(node.type)) return Globe2;
  if (/if|switch|merge/i.test(node.type)) return GitBranch;
  if (/agent|gemini|openai/i.test(node.type)) return Bot;
  return Box;
}
function agentStateLabel(state: AgentRunState) {
  return state === 'unknown' ? 'Not executed / unknown' : state;
}
function AgentRow({
  node,
  state,
  selected,
  onSelect,
}: {
  node: WorkflowNode;
  state: AgentRunState;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={selected ? 'selected' : ''} onClick={onSelect}>
      <span className={`agent-mini-icon ${state}`}>
        {createElement(iconFor(node), { size: 15 })}
      </span>
      <span>
        <strong>{node.name}</strong>
        <small>{cleanType(node.type)}</small>
      </span>
      <em>{agentStateLabel(state)}</em>
      <ChevronRight size={14} />
    </button>
  );
}
export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
export function AgentRoster({
  nodes,
  workflow,
  detail,
  onSelect,
}: {
  nodes: WorkflowNode[];
  workflow: Workflow;
  detail: ExecutionDetail | null;
  onSelect: (node: WorkflowNode) => void;
}) {
  return (
    <section className="roster-section">
      <div className="section-heading">
        <span>AGENTS IN THIS SYSTEM</span>
        <small>{nodes.length}</small>
      </div>
      <div className="agent-roster">
        {nodes.map((node) => (
          <AgentRow
            key={node.id}
            node={node}
            state={agentRunState(node, workflow, detail)}
            selected={false}
            onSelect={() => onSelect(node)}
          />
        ))}
      </div>
    </section>
  );
}
export function AgentInspector({
  node,
  workflow,
  detail,
  onClose,
  onEdit,
}: {
  node: WorkflowNode;
  workflow: Workflow;
  detail: ExecutionDetail | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const state = agentRunState(node, workflow, detail);
  const step = detail?.steps.find((item) => item.name === node.name);
  const dependencies = workflow.edges
    .filter((edge) => edge.to === node.name)
    .map((edge) => edge.from);
  const downstream = workflow.edges
    .filter((edge) => edge.from === node.name)
    .map((edge) => edge.to);
  return (
    <section className="agent-inspector">
      <div className="section-heading">
        <span>AGENT DETAIL</span>
        <button onClick={onClose} aria-label="Close Agent inspection">
          <X size={15} />
        </button>
      </div>
      <div className="agent-inspector-title">
        <span className={`agent-mini-icon ${state}`}>
          <Bot size={18} />
        </span>
        <div>
          <strong>{node.name}</strong>
          <small>{cleanType(node.type)}</small>
        </div>
        <em>{agentStateLabel(state)}</em>
      </div>
      <dl>
        <div>
          <dt>Latest duration</dt>
          <dd>{formatDuration(step?.durationMs ?? null)}</dd>
        </div>
        <div>
          <dt>Dependencies</dt>
          <dd>{dependencies.join(', ') || 'Entry point'}</dd>
        </div>
        <div>
          <dt>Feeds</dt>
          <dd>{downstream.join(', ') || 'Final Agent'}</dd>
        </div>
      </dl>
      <button className="agent-edit-action" onClick={onEdit}>
        <Pencil size={15} /> Edit this agent in workflow studio
      </button>
      {step?.error && (
        <div className="agent-error">
          <AlertTriangle size={15} />
          <span>{step.error}</span>
        </div>
      )}
      {step?.output !== undefined && (
        <details>
          <summary>Latest sanitized output</summary>
          <pre>{JSON.stringify(step.output, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
export function ApprovalPanel({
  enabled,
  detail,
  busy,
  onAction,
}: {
  enabled: boolean;
  detail: ExecutionDetail | null;
  busy: string;
  onAction: (action: ApprovalAction) => void;
}) {
  // Approval controls are available only when this workflow exposes the
  // dedicated, enabled POST webhook. Do not reserve sidebar space otherwise.
  if (!enabled) return null;

  return (
    <section className="approval-panel">
      <p>
        Send a decision for {detail ? `execution #${detail.id}` : 'a selected execution'} through the dedicated n8n approval webhook.
      </p>
      <div>
        <button
          onClick={() => onAction('reject')}
          disabled={!detail || !!busy}
        >
          Reject
        </button>
        <button
          className="approve"
          onClick={() => onAction('approve')}
          disabled={!detail || !!busy}
        >
          {busy === 'approve' ? (
            <LoaderCircle size={14} className="spin-icon" />
          ) : (
            <Check size={14} />
          )}{' '}
          Approve
        </button>
      </div>
    </section>
  );
}
export function ExecutionDetailPanel({
  detail,
  instanceUrl,
}: {
  detail: ExecutionDetail;
  instanceUrl?: string;
}) {
  return (
    <div className="execution-detail">
      <div className="section-heading">
        <div>
          <span>EXECUTION #{detail.id}</span>
          <small>{detail.error ? 'Failure diagnosis' : 'Agent trace'}</small>
        </div>
        {instanceUrl && (
          <a
            href={`${instanceUrl}/workflow/${encodeURIComponent(detail.workflowId)}/executions/${encodeURIComponent(detail.id)}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in n8n <ExternalLink size={13} />
          </a>
        )}
      </div>
      {detail.error && (
        <div className="execution-error">
          <AlertTriangle size={17} />
          <div>
            <strong>{detail.lastNode || 'Workflow error'}</strong>
            <p>{detail.error}</p>
            {detail.hint && <small>{detail.hint}</small>}
          </div>
        </div>
      )}
      <div className="step-trace">
        {detail.steps.map((step, index) => (
          <div key={`${step.name}-${index}`} className={step.status}>
            <span>
              {step.status === 'success' ? (
                <Check size={13} />
              ) : step.status === 'error' ? (
                <X size={13} />
              ) : (
                <Clock3 size={13} />
              )}
            </span>
            <div>
              <strong>{step.name}</strong>
              <small>
                {step.status} · {formatDuration(step.durationMs)}
              </small>
            </div>
          </div>
        ))}
      </div>
      <ExecutionDataView detail={detail} />
    </div>
  );
}
