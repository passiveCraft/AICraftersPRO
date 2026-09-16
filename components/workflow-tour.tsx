'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Mic2, X } from 'lucide-react';
import { nodeNarration } from '@/lib/demo-readiness';
import type { Workflow, WorkflowNode } from '@/lib/n8n-types';

export function WorkflowTour({ workflow, node, onNode, onClose }: { workflow: Workflow; node: WorkflowNode | null; onNode: (node: WorkflowNode | null) => void; onClose: () => void; }) {
  const index = Math.max(0, node ? workflow.nodes.findIndex((item) => item.id === node.id) : 0);
  const current = workflow.nodes[index];
  const [target, setTarget] = useState<DOMRect | null>(null);
  const move = useCallback((offset: number) => onNode(workflow.nodes[(index + offset + workflow.nodes.length) % workflow.nodes.length] || null), [index, onNode, workflow.nodes]);

  useLayoutEffect(() => {
    if (!current) return;
    const element = document.querySelector<HTMLElement>(`[data-agent-id="${CSS.escape(current.id)}"]`);
    const update = () => setTarget(element?.getBoundingClientRect() || null);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [current]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move, onClose]);

  const cardWidth = 304;
  const position = target && {
    left: target.right + 18 + cardWidth <= window.innerWidth - 16 ? target.right + 18 : Math.max(16, target.left - cardWidth - 18),
    top: Math.max(16, Math.min(target.top, window.innerHeight - 338)),
  };
  const targetIsVisible = !!target && target.bottom > 0 && target.top < window.innerHeight;

  if (!current || !position || !targetIsVisible) return null;
  return <section className="tour-tip" style={position} aria-label={`Guided tour: ${current.name}`}>
    <header><span>GUIDED TOUR · {index + 1}/{workflow.nodes.length}</span><button className="icon-button" onClick={onClose} aria-label="Close tour"><X size={16} /></button></header>
    <div className="tour-tip-copy"><Mic2 size={16} /><p>{nodeNarration(current, workflow)}</p></div>
    <strong>{current.name}</strong><small>{current.type}</small>
    <footer><button className="ghost-action" onClick={() => move(-1)}><ChevronLeft size={16} /> Previous</button><button className="primary-action" onClick={() => move(1)}>{index === workflow.nodes.length - 1 ? 'Restart' : 'Next'} <ChevronRight size={16} /></button></footer>
  </section>;
}
