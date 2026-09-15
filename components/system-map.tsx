'use client';

import { useState } from 'react';
import {
  Radar,
  Store,
  Clapperboard,
  Crosshair,
  Users,
  Mail,
  MessageSquare,
  Headphones,
  PackageCheck,
  ChartNoAxesCombined,
  LockKeyhole,
  AlertTriangle,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { HudCore } from './hud-core';
import type { MappedSystem } from '@/lib/ai-crafters';
import { workflowRuns } from '@/lib/ai-crafters';
import type { Execution, Workflow } from '@/lib/n8n-types';

const icons = [
  Radar,
  Store,
  Clapperboard,
  Crosshair,
  Users,
  Mail,
  MessageSquare,
  Headphones,
  PackageCheck,
  ChartNoAxesCombined,
];
const positions = [
  [16, 17],
  [13, 35],
  [16, 53],
  [84, 17],
  [87, 35],
  [84, 53],
  [87, 71],
  [73, 88],
  [50, 91],
  [23, 86],
];
export function SystemMap({
  systems,
  executions,
  connected,
  historyError,
  query,
  onSelect,
  otherWorkflows,
  onSelectWorkflow,
  hiddenWorkflowIds,
}: {
  systems: MappedSystem[];
  executions: Execution[];
  connected: boolean;
  historyError?: string;
  query: string;
  onSelect: (n: number) => void;
  otherWorkflows: Workflow[];
  onSelectWorkflow: (workflow: Workflow) => void;
  hiddenWorkflowIds: string[];
}) {
  const [focused, setFocused] = useState<number | null>(null);
  const visible = systems.filter((s) =>
    (!s.workflow || !hiddenWorkflowIds.includes(s.workflow.id)) && `${s.name} ${s.group}`.toLowerCase().includes(query.toLowerCase()),
  );
  const visibleWorkflows = otherWorkflows.filter((workflow) =>
    workflow.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="command-map" aria-label="Ecommerce System map">
      <svg
        className="membership-paths"
        viewBox="0 0 1000 720"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {visible.map((s) => {
          const [x, y] = positions[s.number - 1];
          return (
            <path
              key={s.number}
              className={focused === s.number ? 'highlight' : ''}
              d={`M 500 345 Q ${x * 10} 345 ${x * 10} ${y * 7.2}`}
            />
          );
        })}
      </svg>
      <HudCore connected={systems.filter((s) => s.workflow).length} />
      {/* <span className="area-label discover">DISCOVER + BUILD</span>
      <span className="area-label acquire">ACQUIRE DEMAND</span>
      <span className="area-label retain">MONETIZE + RETAIN</span>
      <span className="area-label learn">LEARN + SCALE</span> */}
      <div className="satellite-list">
        {visible.map((s) => {
          const run = workflowRuns(executions, s.workflow?.id)[0];
          const Icon = icons[s.number - 1];
          const status = !connected
            ? 'Disconnected'
            : s.duplicateIds.length
              ? 'Duplicate names'
              : !s.workflow
                ? 'Not connected'
                : !s.workflow.active
                  ? 'Paused'
                  : historyError
                    ? 'History unavailable'
                    : !run
                      ? 'No loaded runs'
                      : ['running', 'new', 'waiting'].includes(run.status)
                        ? run.status
                        : ['error', 'crashed', 'canceled'].includes(run.status)
                          ? 'Needs attention'
                          : run.status === 'success'
                            ? 'Last run completed'
                            : run.status;
          return (
            <button
              key={s.number}
              className={`satellite ${!s.workflow ? 'locked' : ''} ${focused === s.number ? 'focused' : ''}`}
              style={{
                left: `${positions[s.number - 1][0]}%`,
                top: `${positions[s.number - 1][1]}%`,
              }}
              aria-label={`${s.name}, ${status}`}
              onClick={() => onSelect(s.number)}
              onMouseEnter={() => setFocused(s.number)}
              onMouseLeave={() => setFocused(null)}
              onFocus={() => setFocused(s.number)}
              onBlur={() => setFocused(null)}
            >
              <span className="satellite-orb">
                {s.duplicateIds.length ? (
                  <AlertTriangle size={25} />
                ) : !s.workflow ? (
                  <LockKeyhole size={23} />
                ) : (
                  <Icon size={25} strokeWidth={1.5} />
                )}
              </span>
              <span className="satellite-copy">
                <small>SYSTEM {String(s.number).padStart(2, '0')}</small>
                <span className="satellite-group">{s.group}</span>
                <strong>{s.name}</strong>
                <span>
                  {status}
                  {s.workflow ? ` · ${s.workflow.nodes.length} Agents` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {visibleWorkflows.length > 0 && (
        <div className="workflow-map-list" aria-label="Other n8n workflows">
          <div className="workflow-map-heading">
            <span>CONNECTED WORKFLOWS</span>
            <small>{visibleWorkflows.length} outside the named Systems</small>
          </div>
          <div className="workflow-map-items">
            {visibleWorkflows.map((workflow) => (
              <button
                key={workflow.id}
                className="workflow-map-item"
                onClick={() => onSelectWorkflow(workflow)}
                title={`Open ${workflow.name} details`}
              >
                <span className="workflow-map-icon"><WorkflowIcon size={19} /></span>
                <span className="workflow-map-copy">
                  <strong>{workflow.name}</strong>
                  <small>{workflow.active ? 'Active' : 'Paused'} · {workflow.nodes.length} steps</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!visible.length && (
        <p className="map-empty">No Systems match your search.</p>
      )}
    </section>
  );
}
