'use client';
/* The custom pan/zoom canvas is keyboard-operated; its Agent buttons remain native controls. */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Minus, Plus, Scan, Search } from 'lucide-react';
import { agentRunState } from '@/lib/ai-crafters';
import { layoutAgents } from '@/lib/agent-layout';
import type { Workflow, WorkflowNode, ExecutionDetail } from '@/lib/n8n-types';

export function AgentGraph({
  workflow,
  detail,
  selected,
  onSelect,
}: {
  workflow: Workflow;
  detail: ExecutionDetail | null;
  selected: WorkflowNode | null;
  onSelect: (node: WorkflowNode) => void;
}) {
  const layout = useMemo(() => layoutAgents(workflow), [workflow]);
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const [size, setSize] = useState({ width: 800, height: 560 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState('');
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale =
    Math.min(size.width / layout.width, size.height / layout.height, 1) * zoom;
  const related = new Set(
    selected
      ? [
          selected.name,
          ...workflow.edges
            .filter((e) => e.from === selected.name || e.to === selected.name)
            .flatMap((e) => [e.from, e.to]),
        ]
      : [],
  );
  const matches = workflow.nodes.filter((n) =>
    `${n.name} ${n.type}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section
      className="agent-network"
      aria-label="Real workflow Agent topology"
    >
      <div className="graph-controls">
        <label className="hud-search">
          <Search size={17} />
          <input
            aria-label="Find an Agent"
            placeholder="Find an Agent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div>
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
          >
            <Minus size={18} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          >
            <Plus size={18} />
          </button>
          <button
            aria-label="Fit graph"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Scan size={18} />
          </button>
        </div>
      </div>
      <div
        className="agent-canvas"
        role="application"
        ref={host}
        tabIndex={0}
        aria-label="Agent map. Arrow keys pan; Tab visits Agents."
        onKeyDown={(e) => {
          const offsets: Record<string, number[]> = {
            ArrowLeft: [40, 0],
            ArrowRight: [-40, 0],
            ArrowUp: [0, 40],
            ArrowDown: [0, -40],
          };
          if (e.target === e.currentTarget && offsets[e.key]) {
            e.preventDefault();
            const [x, y] = offsets[e.key];
            setPan((p) => ({ x: p.x + x, y: p.y + y }));
          }
        }}
        onPointerDown={(e) => {
          if ((e.target as Element).closest('button')) return;
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setPan({
              x: drag.current.px + e.clientX - drag.current.x,
              y: drag.current.py + e.clientY - drag.current.y,
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="agent-plane"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${(size.width - layout.width * scale) / 2 + pan.x}px, ${(size.height - layout.height * scale) / 2 + pan.y}px) scale(${scale})`,
          }}
        >
          <svg width={layout.width} height={layout.height} aria-hidden="true">
            <defs>
              <marker
                id="agent-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10" fill="currentColor" />
              </marker>
            </defs>
            {workflow.edges.map((e, i) => {
              const a = layout.points.get(e.from),
                b = layout.points.get(e.to);
              if (!a || !b) return null;
              const active = related.has(e.from) && related.has(e.to);
              return (
                <path
                  key={i}
                  className={`agent-edge ${active ? 'highlight' : ''}`}
                  markerEnd="url(#agent-arrow)"
                  d={`M${a.x + 34} ${a.y} C${(a.x + b.x) / 2} ${a.y},${(a.x + b.x) / 2} ${b.y},${b.x - 40} ${b.y}`}
                />
              );
            })}
          </svg>
          {workflow.nodes.map((node) => {
            const p = layout.points.get(node.name)!;
            const state = agentRunState(node, workflow, detail);
            return (
              <button
                key={node.id}
                className={`agent-control ${state} ${selected?.id === node.id ? 'selected' : ''} ${!matches.includes(node) || (selected && !related.has(node.name)) ? 'dimmed' : ''}`}
                style={{ left: p.x, top: p.y }}
                onClick={() => onSelect(node)}
                aria-pressed={selected?.id === node.id}
              >
                <span className="agent-orb">
                  <Bot size={26} />
                </span>
                <strong>{node.name}</strong>
                <small>
                  {state === 'unknown' ? 'Not executed / unknown' : state}
                </small>
              </button>
            );
          })}
        </div>
        {!workflow.nodes.length && (
          <p className="graph-empty">No Agents in this workflow.</p>
        )}
      </div>
      <div className="agent-access-list" aria-label="Agent navigation">
        {matches.map((node) => (
          <button
            key={node.id}
            aria-pressed={selected?.id === node.id}
            onClick={() => onSelect(node)}
          >
            <Bot size={17} />
            <span>{node.name}</span>
            <small>{agentRunState(node, workflow, detail)}</small>
          </button>
        ))}
      </div>
      <p className="graph-note">
        n8n topology · select an Agent to inspect dependencies and output
      </p>
    </section>
  );
}
