'use client';

import { useState } from 'react';
import { Radar, Store, Clapperboard, Crosshair, Users, Mail, MessageSquare, Headphones, PackageCheck, ChartNoAxesCombined } from 'lucide-react';
import { HudCore } from './hud-core';
import { workflowRuns } from '@/lib/ai-crafters';
import type { Execution, Workflow } from '@/lib/n8n-types';

const icons = [Radar, Store, Clapperboard, Crosshair, Users, Mail, MessageSquare, Headphones, PackageCheck, ChartNoAxesCombined];

function positionFor(index: number, total: number) {
  // Keep Systems visibly separated from the central core.
  if (total === 1) return { x: 50, y: 10 };
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(total, 1);
  const radiusX = total > 8 ? 43 : 41;
  const radiusY = total > 8 ? 42 : 40;
  return { x: 50 + Math.cos(angle) * radiusX, y: 50 + Math.sin(angle) * radiusY };
}

function statusFor(workflow: Workflow, executions: Execution[], connected: boolean, historyError?: string) {
  const run = workflowRuns(executions, workflow.id)[0];
  if (!connected) return 'Disconnected';
  if (!workflow.active) return 'Paused';
  if (historyError) return 'History unavailable';
  if (!run) return 'No loaded runs';
  if (['running', 'new', 'waiting'].includes(run.status)) return run.status;
  if (['error', 'crashed', 'canceled'].includes(run.status)) return 'Needs attention';
  return run.status === 'success' ? 'Last run completed' : run.status;
}

export function SystemMap({ workflows, executions, connected, historyError, query, onSelectWorkflow }: { workflows: Workflow[]; executions: Execution[]; connected: boolean; historyError?: string; query: string; onSelectWorkflow: (workflow: Workflow) => void; }) {
  const [focused, setFocused] = useState<string | null>(null);
  const visible = workflows.filter((workflow) => workflow.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="command-map" aria-label="n8n system map">
      <svg className="membership-paths" viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true">
        {visible.map((workflow, index) => {
          const { x, y } = positionFor(index, visible.length);
          return <path key={workflow.id} className={focused === workflow.id ? 'highlight' : ''} d={`M 500 345 Q ${x * 10} 345 ${x * 10} ${y * 7.2}`} />;
        })}
      </svg>
      <HudCore connected={visible.length} empty={!visible.length} />
      <div className="satellite-list">
        {visible.map((workflow, index) => {
          const { x, y } = positionFor(index, visible.length);
          const Icon = icons[index % icons.length];
          const status = statusFor(workflow, executions, connected, historyError);
          return <button key={workflow.id} className={`satellite ${focused === workflow.id ? 'focused' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} aria-label={`${workflow.name}, ${status}`} onClick={() => onSelectWorkflow(workflow)} onMouseEnter={() => setFocused(workflow.id)} onMouseLeave={() => setFocused(null)} onFocus={() => setFocused(workflow.id)} onBlur={() => setFocused(null)}>
            <span className="satellite-orb"><Icon size={25} strokeWidth={1.5} /></span>
            <span className="satellite-copy"><small>SYSTEM</small><strong>{workflow.name}</strong><span>{status} · {workflow.nodes.length} steps</span></span>
          </button>;
        })}
      </div>
      {!visible.length && query && <p className="map-empty">No systems match your search.</p>}
    </section>
  );
}
