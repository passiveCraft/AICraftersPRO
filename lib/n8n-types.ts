export type WorkflowNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  disabled: boolean;
  position: [number, number];
  parameters: Record<string, unknown>;
};
export type Workflow = {
  id: string; name: string; active: boolean; archived: boolean; updatedAt: string | null;
  tags: string[]; nodes: WorkflowNode[]; edges: { from: string; to: string; type: string; output?: number; input?: number }[];
  settings?: Record<string, unknown>;
};
export type WorkflowDraft = Pick<Workflow, 'name' | 'nodes' | 'edges'> & { settings?: Record<string, unknown> };
export type Execution = { id: string; workflowId: string; status: string; mode: string; startedAt: string | null; stoppedAt: string | null; };
export type Page<T> = { data: T[]; nextCursor: string | null };
export type Snapshot = {
  connected: boolean; instanceUrl?: string; connectedAt?: string; syncedAt?: string;
  workflows: Page<Workflow>; executions: Page<Execution>; executionError?: string;
};
