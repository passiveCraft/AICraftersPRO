export type RunMode = 'manual' | 'assisted' | 'automatic' | 'monitor';
export type ApprovalMode = 'never' | 'before-action' | 'always';

export type DemoAgent = {
  id: string;
  name: string;
  purpose: string;
  outcome: string;
  runMode: RunMode;
  approval: ApprovalMode;
};

export type DemoManifest = {
  systemName: string;
  promise: string;
  audience: string;
  inputSummary: string;
  outputSummary: string;
  runMode: RunMode;
  approval: ApprovalMode;
  agents: DemoAgent[];
  resources: { label: string; type: 'prompt' | 'workflow' | 'guide' }[];
};

const productOpportunityAgents: DemoAgent[] = [
  { id: 'review-miner', name: 'Review Miner', purpose: 'Extract repeated customer language from reviews and support conversations.', outcome: 'Evidence-backed pain themes', runMode: 'manual', approval: 'never' },
  { id: 'pain-classifier', name: 'Pain Point Classifier', purpose: 'Group pain by urgency, frequency, and buying context.', outcome: 'Prioritized customer problems', runMode: 'assisted', approval: 'before-action' },
  { id: 'competitor-signal', name: 'Competitor Signal Agent', purpose: 'Compare competing promises, gaps, and proof without inventing claims.', outcome: 'Positioning gaps with sources', runMode: 'manual', approval: 'never' },
  { id: 'demand-pattern', name: 'Demand Pattern Agent', purpose: 'Find demand signals across the supplied commerce evidence.', outcome: 'Demand hypotheses with confidence', runMode: 'monitor', approval: 'never' },
  { id: 'offer-scoring', name: 'Offer Scoring Agent', purpose: 'Score opportunities by evidence, margin potential, risk, and effort.', outcome: 'Ranked opportunity shortlist', runMode: 'assisted', approval: 'before-action' },
  { id: 'opportunity-brief', name: 'Opportunity Brief Writer', purpose: 'Turn the selected opportunity into an actionable ecommerce brief.', outcome: 'Build-ready opportunity brief', runMode: 'manual', approval: 'always' },
];

const defaults: Record<string, Omit<DemoManifest, 'systemName'>> = {
  'Store & Conversion': { promise: 'Turn an approved offer into a conversion-ready storefront plan.', audience: 'Ecommerce operators improving an existing store.', inputSummary: 'Offer, product facts, customer objections, and current page evidence.', outputSummary: 'Page priorities, trust gaps, mobile fixes, and QA checklist.', runMode: 'assisted', approval: 'before-action', agents: [], resources: [{ label: 'Store audit prompt', type: 'prompt' }, { label: 'Conversion workflow', type: 'workflow' }, { label: 'How to review the output', type: 'guide' }] },
  'Creative Production': { promise: 'Build evidence-backed creative angles from real customer language.', audience: 'Founders and creative operators.', inputSummary: 'Customer language, approved claims, product facts, and channel.', outputSummary: 'Hooks, concepts, briefs, and unsupported-claim warnings.', runMode: 'assisted', approval: 'before-action', agents: [], resources: [{ label: 'Creative brief prompt', type: 'prompt' }, { label: 'Creative workflow', type: 'workflow' }] },
  'Paid Acquisition': { promise: 'Make paid growth decisions with guardrails instead of guesses.', audience: 'Operators managing performance spend.', inputSummary: 'Campaign metrics, budget limits, audience, and creative evidence.', outputSummary: 'Budget recommendations, kill rules, and measurement gaps.', runMode: 'monitor', approval: 'always', agents: [], resources: [{ label: 'Media decision prompt', type: 'prompt' }, { label: 'Paid growth workflow', type: 'workflow' }] },
  'Customer Support': { promise: 'Resolve customer issues consistently while escalating uncertainty.', audience: 'Support and operations teams.', inputSummary: 'Ticket, order context, policies, and prior resolution evidence.', outputSummary: 'Classification, suggested response, risk, and escalation owner.', runMode: 'automatic', approval: 'before-action', agents: [], resources: [{ label: 'Support policy prompt', type: 'prompt' }, { label: 'Support workflow', type: 'workflow' }] },
};

export function demoManifestFor(systemName: string): DemoManifest {
  const detail = defaults[systemName] || { promise: `Operate ${systemName.toLowerCase()} from evidence supplied by your store.`, audience: 'Ecommerce founders and operators.', inputSummary: 'The business context and data supplied to this demo.', outputSummary: 'A recommendation, trace, and next action grounded in supplied evidence.', runMode: 'manual' as RunMode, approval: 'before-action' as ApprovalMode, agents: [], resources: [{ label: 'Demo prompt', type: 'prompt' as const }, { label: 'n8n workflow JSON', type: 'workflow' as const }] };
  if (systemName === 'Product & Market Intelligence') return { systemName, ...detail, promise: 'Find product opportunities from customer and market evidence.', audience: 'Ecommerce founders deciding what to build or promote.', inputSummary: 'Reviews, support conversations, search signals, competitor evidence, and product facts.', outputSummary: 'Ranked opportunities with evidence, confidence, risks, and a recommended next experiment.', runMode: 'assisted', approval: 'before-action', agents: productOpportunityAgents, resources: [{ label: 'Opportunity research prompt', type: 'prompt' }, { label: 'n8n workflow JSON', type: 'workflow' }, { label: 'Build this demo yourself', type: 'guide' }] };
  return { systemName, ...detail };
}
