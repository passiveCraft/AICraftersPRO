import type { Workflow } from './n8n-types';

/** Preserve n8n placement and separate overlapping labels without inventing edges. */
export function layoutAgents(workflow: Workflow) {
  const points = new Map<string, { x: number; y: number }>();
  const nodes = [...workflow.nodes].sort(
    (a, b) => a.position[0] - b.position[0] || a.position[1] - b.position[1],
  );
  const minX = nodes.length
    ? Math.min(
        ...nodes.map((n) =>
          Number.isFinite(n.position[0]) ? n.position[0] : 0,
        ),
      )
    : 0;
  const minY = nodes.length
    ? Math.min(
        ...nodes.map((n) =>
          Number.isFinite(n.position[1]) ? n.position[1] : 0,
        ),
      )
    : 0;
  for (const node of nodes) {
    const x =
      (Number.isFinite(node.position[0]) ? node.position[0] : 0) - minX + 140;
    let y =
      (Number.isFinite(node.position[1]) ? node.position[1] : 0) - minY + 110;
    while (
      [...points.values()].some(
        (p) => Math.abs(p.x - x) < 240 && Math.abs(p.y - y) < 170,
      )
    )
      y += 180;
    points.set(node.name, { x, y });
  }
  return {
    points,
    width: Math.max(500, ...[...points.values()].map((p) => p.x + 140)),
    height: Math.max(360, ...[...points.values()].map((p) => p.y + 110)),
  };
}
