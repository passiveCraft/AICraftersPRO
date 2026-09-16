'use client';
/* The custom pan/zoom canvas is keyboard-operated; its Agent buttons remain native controls. */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bot, Map, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { agentRunState } from '@/lib/ai-crafters';
import { layoutAgents } from '@/lib/agent-layout';
import type { Workflow, WorkflowNode, ExecutionDetail } from '@/lib/n8n-types';

export function AgentGraph({
  workflow,
  detail,
  selected,
  touring = false,
  onStartTour,
  onSelect,
}: {
  workflow: Workflow;
  detail: ExecutionDetail | null;
  selected: WorkflowNode | null;
  touring?: boolean;
  onStartTour: () => void;
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
  const [fullScreen, setFullScreen] = useState(false);
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
  useEffect(() => {
    if (!fullScreen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullScreen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [fullScreen]);
  useLayoutEffect(() => {
    if (!fullScreen) return;
    let secondFrame = 0;
    const measureAndCenter = () => {
      const rect = host.current?.getBoundingClientRect();
      if (!rect || !rect.width || !rect.height) return;
      // Fixed positioning changes the canvas dimensions after the surrounding
      // page has scrolled. Measure the real viewport canvas instead of reusing
      // its former inline height.
      setSize({ width: rect.width, height: rect.height });
      setPan({ x: 0, y: 0 });
    };
    const firstFrame = window.requestAnimationFrame(() => {
      measureAndCenter();
      secondFrame = window.requestAnimationFrame(measureAndCenter);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [fullScreen]);
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
  return (
    <section
      className={`agent-network ${fullScreen ? 'is-fullscreen' : ''}`}
      aria-label="Real workflow Agent topology"
    >
      <div className="graph-controls">
        <span className="graph-title"></span>
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
            aria-label={fullScreen ? 'Exit full-screen agent canvas' : 'Show agent canvas full screen'}
            title={fullScreen ? 'Exit full screen' : 'Full-screen agent canvas'}
            onClick={() => {
              // A full-screen canvas should always open on the complete graph,
              // even if the operator previously panned or zoomed the inline view.
              setPan({ x: 0, y: 0 });
              setZoom(1);
              setFullScreen((open) => !open);
            }}
          >
            {fullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button aria-label="Start guided tour" title="Start guided tour" onClick={onStartTour}>
            <Map size={18} />
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
        onWheel={(event) => {
          event.preventDefault();
          setZoom((value) => Math.max(0.4, Math.min(3, value - event.deltaY * .001)));
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
                data-agent-id={node.id}
                className={`agent-control ${state} ${selected?.id === node.id ? `selected ${touring ? 'tour-spotlight' : ''}` : ''} ${selected && !related.has(node.name) ? 'dimmed' : ''}`}
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
      <p className="graph-note">
        n8n topology · select an Agent to inspect dependencies and output
      </p>
    </section>
  );
}
