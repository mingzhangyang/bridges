import { cityLayout } from './layouts.js';
export function geometry(level, portrait = false) {
  const w = portrait ? 720 : 1100,
    h = portrait ? 820 : 670;
  const layout = cityLayout(level, portrait),
    positions = layout.points;
  const nodes = Object.fromEntries(
    level.nodes.map((node, i) => [node.id, { x: positions[i][0], y: positions[i][1] }]),
  );
  const possible = [
    ...level.edges,
    ...(level.candidateEdits ?? []).filter((e) => e.kind === 'add').map((e) => e.edge),
  ];
  const curves = {};
  for (const edge of possible) {
    const same = possible.filter(
      (e) => [e.u, e.v].sort().join('') === [edge.u, edge.v].sort().join(''),
    );
    const index = same.findIndex((e) => e.id === edge.id),
      canonical = [edge.u, edge.v].sort();
    const a = nodes[canonical[0]],
      b = nodes[canonical[1]],
      dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy),
      nx = -dy / len,
      ny = dx / len;
    const offset = (layout.bends[canonical.join('')] ?? 0) + (index - (same.length - 1) / 2) * 100;
    const c = { x: (a.x + b.x) / 2 + nx * offset * 2, y: (a.y + b.y) / 2 + ny * offset * 2 };
    const point = (t) => ({
      x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
      y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
    });
    const samples = Array.from({ length: 65 }, (_, i) => point(i / 64));
    curves[edge.id] = {
      a,
      b,
      c,
      canonical,
      point,
      samples,
      path: `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`,
    };
  }
  return { w, h, nodes, curves };
}
