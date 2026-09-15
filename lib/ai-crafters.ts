import type {
  Execution,
  ExecutionDetail,
  Workflow,
  WorkflowNode,
} from './n8n-types';

export const AI_CRAFTERS_SYSTEMS = [
  {
    number: 1,
    name: 'Product & Market Intelligence',
    group: 'Discover + Build',
  },
  { number: 2, name: 'Store & Conversion', group: 'Discover + Build' },
  { number: 3, name: 'Creative Production', group: 'Discover + Build' },
  { number: 4, name: 'Paid Acquisition', group: 'Acquire Demand' },
  { number: 5, name: 'Organic & Creators', group: 'Acquire Demand' },
  { number: 6, name: 'Email Marketing', group: 'Monetize + Retain' },
  { number: 7, name: 'SMS Marketing', group: 'Monetize + Retain' },
  { number: 8, name: 'Customer Support', group: 'Monetize + Retain' },
  { number: 9, name: 'Fulfillment & Retention', group: 'Monetize + Retain' },
  { number: 10, name: 'Analytics & Growth', group: 'Learn + Scale' },
] as const;

export type SystemDefinition = (typeof AI_CRAFTERS_SYSTEMS)[number];

export type MappedSystem = SystemDefinition & {
  workflow: Workflow | null;
  duplicateIds: string[];
};

export function mapSystems(workflows: Workflow[]): MappedSystem[] {
  return AI_CRAFTERS_SYSTEMS.map((definition) => {
    const matches = workflows.filter(
      (workflow) => workflow.name === definition.name && !workflow.archived,
    );
    return {
      ...definition,
      workflow: matches.length === 1 ? matches[0] : null,
      duplicateIds:
        matches.length > 1 ? matches.map((workflow) => workflow.id) : [],
    };
  });
}

export function unmatchedWorkflows(workflows: Workflow[]): Workflow[] {
  const names = new Set(AI_CRAFTERS_SYSTEMS.map((system) => system.name));
  return workflows.filter(
    (workflow) =>
      !workflow.archived &&
      !names.has(workflow.name as SystemDefinition['name']),
  );
}

export function workflowRuns(
  executions: Execution[],
  workflowId?: string,
): Execution[] {
  if (!workflowId) return [];
  return executions
    .filter((execution) => execution.workflowId === workflowId)
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
}

export function runDuration(run: Execution): number | null {
  if (!run.startedAt || !run.stoppedAt) return null;
  const duration = Date.parse(run.stoppedAt) - Date.parse(run.startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

export function systemMetrics(executions: Execution[]) {
  const completed = executions.filter((run) =>
    ['success', 'finished', 'error', 'crashed', 'canceled'].includes(
      run.status,
    ),
  );
  const successful = completed.filter((run) =>
    ['success', 'finished'].includes(run.status),
  ).length;
  const failures = completed.filter((run) =>
    ['error', 'crashed', 'canceled'].includes(run.status),
  ).length;
  const durations = completed
    .map(runDuration)
    .filter((value): value is number => value !== null);
  return {
    runCount: executions.length,
    successRate: completed.length
      ? Math.round((successful / completed.length) * 100)
      : null,
    averageDurationMs: durations.length
      ? Math.round(
          durations.reduce((sum, value) => sum + value, 0) / durations.length,
        )
      : null,
    failures,
  };
}

export type AgentRunState =
  | 'disabled'
  | 'unknown'
  | 'waiting'
  | 'running'
  | 'success'
  | 'error';

export function agentRunState(
  node: WorkflowNode,
  _workflow: Workflow,
  detail: ExecutionDetail | null,
): AgentRunState {
  if (node.disabled) return 'disabled';
  if (!detail) return 'unknown';
  const step = detail.steps.find((item) => item.name === node.name);
  if (step) return step.status;
  return 'unknown';
}

export function hasApprovalWebhook(workflow: Workflow): boolean {
  return workflow.nodes.some(
    (node) =>
      node.name === 'AI Crafters Pro Approval' &&
      node.type.endsWith('.webhook') &&
      !node.disabled &&
      (typeof node.parameters.httpMethod === 'string'
        ? node.parameters.httpMethod
        : 'GET'
      ).toUpperCase() === 'POST',
  );
}
