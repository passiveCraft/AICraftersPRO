import type { SystemDefinition } from './ai-crafters';
import type { Credential } from './n8n-types';

type AgentBrief = { context: string; ai: string; decision: string; objective: string };

const BRIEFS: Record<SystemDefinition['name'], AgentBrief> = {
  'Product & Market Intelligence': { context: 'Market Context Agent', ai: 'Demand Research Agent', decision: 'Offer Scoring Agent', objective: 'Evaluate product demand, customer pain, competitive pressure, pricing evidence, and validation risk. Return concise JSON-ready recommendations grounded only in the supplied commerce data.' },
  'Store & Conversion': { context: 'Conversion Context Agent', ai: 'Store Build Planner', decision: 'Conversion QA Agent', objective: 'Turn an approved offer into a conversion-focused storefront plan covering information hierarchy, merchandising, trust, mobile UX, and measurable QA checks.' },
  'Creative Production': { context: 'Customer Insight Agent', ai: 'Creative Director Agent', decision: 'Creative QA Agent', objective: 'Create evidence-based angles, hooks, concepts, and production briefs from customer language while flagging unsupported claims and brand-safety risks.' },
  'Paid Acquisition': { context: 'Budget Guardrail Agent', ai: 'Media Buyer Agent', decision: 'Launch Readiness Agent', objective: 'Recommend channel, audience, campaign structure, creative allocation, budget limits, kill rules, and measurement requirements without inventing performance data.' },
  'Organic & Creators': { context: 'Channel Strategy Agent', ai: 'Content Planner Agent', decision: 'Publishing Guard Agent', objective: 'Build a channel-specific organic and creator plan with reusable formats, briefs, cadence, attribution, and brand-review checkpoints.' },
  'Email Marketing': { context: 'Lifecycle Segment Agent', ai: 'Lifecycle Copywriter Agent', decision: 'Send Guard Agent', objective: 'Recommend lifecycle email timing, segmentation, message strategy, experiments, and suppression safeguards using the supplied customer and order event.' },
  'SMS Marketing': { context: 'Consent Guard Agent', ai: 'SMS Copywriter Agent', decision: 'Frequency Guard Agent', objective: 'Prepare concise SMS recommendations while enforcing consent, quiet-hour, frequency, relevance, and opt-out safeguards. Never assume marketing consent.' },
  'Customer Support': { context: 'Ticket Triage Agent', ai: 'Resolution Agent', decision: 'Escalation Decision Agent', objective: 'Classify the support issue, propose an accurate resolution from supplied policy and order context, and escalate uncertainty, refunds, safety issues, or sensitive cases.' },
  'Fulfillment & Retention': { context: 'Fulfillment Risk Agent', ai: 'Retention Recovery Agent', decision: 'Operations Decision Agent', objective: 'Assess fulfillment exceptions and recommend operational recovery, customer communication, retention action, ownership, and deadlines from supplied order evidence.' },
  'Analytics & Growth': { context: 'Data Quality Agent', ai: 'Growth Analyst Agent', decision: 'Experiment Prioritization Agent', objective: 'Validate metric completeness, identify material changes, propose defensible growth hypotheses, and rank experiments by expected impact, confidence, effort, and risk.' },
};

function code(value: string) {
  return { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: value } };
}

export function buildSystemWorkflow(system: SystemDefinition, credential: Credential) {
  const brief = BRIEFS[system.name];
  const systemNumber = String(system.number).padStart(2, '0');
  const suffix = crypto.randomUUID();
  const inputName = `${system.name} Intake`;
  const positions: Array<[number, number]> = [[0, 0], [260, 0], [540, 0], [820, 0], [0, 260], [270, 260]];
  const nodes = [
    { id: crypto.randomUUID(), name: inputName, type: 'n8n-nodes-base.webhook', typeVersion: 2, position: positions[0], parameters: { httpMethod: 'POST', path: `ai-crafters-pro/system-${systemNumber}/${suffix}`, responseMode: 'onReceived', options: {} } },
    { id: crypto.randomUUID(), name: brief.context, ...code(`const incoming = $json.body ?? $json;\nreturn [{ json: { system: ${JSON.stringify(system.name)}, systemNumber: ${system.number}, requestId: incoming.requestId ?? $execution.id, receivedAt: new Date().toISOString(), objective: incoming.objective ?? 'Operate this ecommerce System from the supplied event', payload: incoming } }];`), position: positions[1] },
    { id: crypto.randomUUID(), name: brief.ai, type: '@n8n/n8n-nodes-langchain.googleGemini', typeVersion: 1.1, position: positions[2], parameters: { resource: 'text', operation: 'message', modelId: { __rl: true, value: 'models/gemini-2.5-flash', mode: 'list' }, messages: { values: [{ role: 'user', content: `={{ ${JSON.stringify(`You are the ${brief.ai} inside AI Crafters Pro System ${systemNumber}: ${system.name}. ${brief.objective} Clearly separate evidence, assumptions, risks, recommended actions, owner, and success metric.\n\nINPUT:\n`)} + JSON.stringify($json) }}` }] }, simplify: true, builtInTools: {}, options: { temperature: 0.2 } }, credentials: { googlePalmApi: { id: credential.id, name: credential.name } } },
    { id: crypto.randomUUID(), name: brief.decision, ...code(`const result = $input.first().json;\nconst recommendation = result.text ?? result.output ?? result;\nreturn [{ json: { system: ${JSON.stringify(system.name)}, systemNumber: ${system.number}, status: 'recommendation_ready', generatedAt: new Date().toISOString(), requiresHumanApproval: true, recommendation } }];`), position: positions[3] },
    { id: crypto.randomUUID(), name: 'AI Crafters Pro Approval', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: positions[4], parameters: { httpMethod: 'POST', path: `ai-crafters-pro/system-${systemNumber}/approval/${suffix}`, responseMode: 'onReceived', options: {} } },
    { id: crypto.randomUUID(), name: 'Approval Audit Agent', ...code(`const decision = $json.body ?? $json;\nif (!['approve', 'reject'].includes(decision.action)) throw new Error('Approval action must be approve or reject');\nreturn [{ json: { system: ${JSON.stringify(system.name)}, executionId: decision.executionId, action: decision.action, requestedBy: decision.requestedBy ?? 'dashboard-operator', recordedAt: new Date().toISOString(), source: decision.source ?? 'ai-crafters-pro-dashboard' } }];`), position: positions[5] },
  ];
  const connections = {
    [inputName]: { main: [[{ node: brief.context, type: 'main', index: 0 }]] },
    [brief.context]: { main: [[{ node: brief.ai, type: 'main', index: 0 }]] },
    [brief.ai]: { main: [[{ node: brief.decision, type: 'main', index: 0 }]] },
    'AI Crafters Pro Approval': { main: [[{ node: 'Approval Audit Agent', type: 'main', index: 0 }]] },
  };
  return { name: system.name, nodes, connections, settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true } };
}
