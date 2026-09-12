export type AgentState = 'waiting' | 'working' | 'completed' | 'needs_attention' | 'failed';

export type SystemAgent = {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  state: AgentState;
  input: string;
  output: string;
  evidence: string[];
};

export type SystemArtifact = {
  id: string;
  title: string;
  summary: string;
  kind: 'signals' | 'research' | 'decision' | 'preview';
  status: 'ready' | 'building' | 'waiting';
  metric: string;
};

export type SystemPack = {
  id: string;
  version: string;
  number: string;
  title: string;
  shortTitle: string;
  module: string;
  outcome: string;
  agents: SystemAgent[];
  artifacts: SystemArtifact[];
  editableSettings: string[];
  resources: { name: string; type: string; detail: string }[];
};

export const productDiscoveryPack: SystemPack = {
  id: 'product-discovery',
  version: '1.0.0',
  number: '01',
  title: 'Product & Market Intelligence',
  shortTitle: 'Product discovery',
  module: 'Discover + build',
  outcome: 'Turn scattered market signals into one offer worth testing.',
  agents: [
    { id: 'strategist', name: 'Strategist', role: 'Defines the market thesis', x: 8, y: 63, state: 'completed', input: 'US desk accessories · $30–$90 AOV', output: 'Prioritized practical desk-friction products with clear visual proof.', evidence: ['Target margin above 68%', 'Lightweight fulfillment', 'Demonstrable before/after'] },
    { id: 'demand', name: 'Demand Signal', role: 'Reads search momentum', x: 23, y: 46, state: 'completed', input: 'Search and social query set', output: '12 rising queries retained from 64 candidates.', evidence: ['“desk cable organizer” +38%', '“magnetic cable holder” +24%', '“clean desk setup” sustained'] },
    { id: 'pain', name: 'Pain Miner', role: 'Clusters customer friction', x: 39, y: 58, state: 'completed', input: '2,184 reviews and 79 community threads', output: '27 recurring complaints grouped into three urgent pains.', evidence: ['Adhesive fails in heat', 'Cables slip under the desk', 'Single-size clips do not fit braided cables'] },
    { id: 'competitor', name: 'Competitor Scan', role: 'Maps offers and pricing', x: 55, y: 39, state: 'completed', input: 'Amazon, Etsy and direct-brand listings', output: '9 comparable offers mapped between $24 and $68.', evidence: ['No premium mixed-size kit', 'Weak replacement guarantee', 'Bundles focus on quantity, not cable type'] },
    { id: 'offer', name: 'Offer Architect', role: 'Shapes a testable offer', x: 70, y: 53, state: 'working', input: 'Demand, pain and competitor evidence', output: 'Ranking three offer hypotheses.', evidence: ['Urgency score', 'Margin model', 'Proof strength'] },
    { id: 'validator', name: 'Validator', role: 'Builds a low-cost test', x: 85, y: 35, state: 'waiting', input: 'Approved offer hypothesis', output: 'Waiting for founder approval.', evidence: ['Presale page', 'Three-message ad test', 'Spend cap: $75'] },
    { id: 'approval', name: 'Founder Decision', role: 'Approves what happens next', x: 91, y: 69, state: 'waiting', input: 'Ranked offer and evidence bundle', output: 'No decision submitted.', evidence: ['Approve top pick', 'Request another pass', 'Stop validation'] },
  ],
  artifacts: [
    { id: 'signals', title: 'Demand signals', summary: 'Search momentum and adjacent intent', kind: 'signals', status: 'ready', metric: '12 rising queries' },
    { id: 'pains', title: 'Pain clusters', summary: 'Recurring problems in customer language', kind: 'research', status: 'ready', metric: '3 themes confirmed' },
    { id: 'offers', title: 'Offer hypotheses', summary: 'Ranked concepts with evidence and economics', kind: 'decision', status: 'building', metric: 'Building now' },
    { id: 'presale', title: 'Presale test', summary: 'Disposable page and controlled validation plan', kind: 'preview', status: 'waiting', metric: 'Needs approval' },
  ],
  editableSettings: ['Market and geography', 'Agent instructions', 'Model selection', 'Spend ceiling', 'Schedule', 'Source URLs'],
  resources: [
    { name: 'n8n workflow pack', type: 'JSON', detail: 'Main system, operator assistant and approval flow' },
    { name: 'Build prompt', type: 'MD', detail: 'Recreates this dashboard and connects the member instance' },
    { name: 'Agent instructions', type: 'MD', detail: 'Seven tested roles with editable operating boundaries' },
    { name: 'Sample market data', type: 'CSV', detail: 'Safe fixture data used by Demo Mode' },
    { name: 'Production checklist', type: 'PDF', detail: 'Credentials, cost controls, privacy and launch verification' },
    { name: 'Troubleshooting guide', type: 'MD', detail: 'Common setup and workflow recovery paths' },
  ],
};

export const systemPacks: SystemPack[] = [productDiscoveryPack];
