import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentRunState, mapSystems, systemMetrics, unmatchedWorkflows } from '../lib/ai-crafters.ts';
import type { ExecutionDetail, Workflow } from '../lib/n8n-types.ts';
import { buildSystemWorkflow } from '../lib/system-workflows.ts';

function workflow(id: string, name: string): Workflow {
  return { id, name, active: true, archived: false, updatedAt: null, tags: [], nodes: [], edges: [], settings: {} };
}

test('maps exact workflow names, locks missing slots and rejects duplicate matches', () => {
  const result = mapSystems([
    workflow('one', 'Product & Market Intelligence'),
    workflow('two', 'Store & Conversion'),
    workflow('duplicate', 'Store & Conversion'),
    workflow('other', 'Unrelated Workflow'),
  ]);
  assert.equal(result.length, 10);
  assert.equal(result[0].workflow?.id, 'one');
  assert.equal(result[1].workflow, null);
  assert.deepEqual(result[1].duplicateIds, ['two', 'duplicate']);
  assert.equal(result[9].workflow, null);
  assert.deepEqual(unmatchedWorkflows([workflow('other', 'Unrelated Workflow')]).map(item => item.id), ['other']);
});

test('derives honest metrics from the loaded execution window', () => {
  const result = systemMetrics([
    { id: '1', workflowId: 'w', status: 'success', mode: 'webhook', startedAt: '2026-01-01T00:00:00Z', stoppedAt: '2026-01-01T00:00:02Z' },
    { id: '2', workflowId: 'w', status: 'error', mode: 'webhook', startedAt: '2026-01-01T00:00:00Z', stoppedAt: '2026-01-01T00:00:04Z' },
    { id: '3', workflowId: 'w', status: 'running', mode: 'webhook', startedAt: '2026-01-01T00:00:00Z', stoppedAt: null },
  ]);
  assert.deepEqual(result, { runCount: 3, successRate: 50, averageDurationMs: 3000, failures: 1 });
});

test('derives Agent state from real node execution details and topology', () => {
  const value = workflow('w', 'Product & Market Intelligence');
  value.nodes = [
    { id: 'a', name: 'Start', type: 'n8n-nodes-base.webhook', typeVersion: 1, disabled: false, position: [0, 0], parameters: {} },
    { id: 'b', name: 'Agent', type: 'n8n-nodes-base.set', typeVersion: 1, disabled: false, position: [100, 0], parameters: {} },
  ];
  value.edges = [{ from: 'Start', to: 'Agent', type: 'main' }];
  const detail: ExecutionDetail = { id: 'e', workflowId: 'w', status: 'running', mode: 'webhook', startedAt: null, stoppedAt: null, lastNode: 'Start', steps: [{ name: 'Start', status: 'success', durationMs: 2 }] };
  assert.equal(agentRunState(value.nodes[0], value, detail), 'success');
  assert.equal(agentRunState(value.nodes[1], value, detail), 'running');
});

test('builds each ecommerce System with a runnable intake, Gemini Agent and explicit approval webhook', () => {
  const system = mapSystems([])[0];
  const draft = buildSystemWorkflow(system, { id: 'cred-1', name: 'Gemini', type: 'googlePalmApi' });
  assert.equal(draft.name, 'Product & Market Intelligence');
  assert.equal(draft.nodes.length, 6);
  assert.ok(draft.nodes.some(node => node.name === 'AI Crafters Pro Approval' && node.type.endsWith('.webhook')));
  const gemini = draft.nodes.find(node => node.type.includes('googleGemini'));
  assert.deepEqual(gemini?.credentials, { googlePalmApi: { id: 'cred-1', name: 'Gemini' } });
  assert.ok(draft.connections['Product & Market Intelligence Intake']);
});
