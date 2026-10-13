export function geometry(level, portrait = false) {
  const w = portrait ? 720 : 1100,
    h = portrait ? 820 : 670,
    n = level.nodes.length;
  let positions;
  if (n === 4 && level.edges.some((e) => e.id === 'AB1'))
    positions = portrait
      ? [
          [270, 410],
          [260, 165],
          [260, 665],
          [540, 410],
        ]
      : [
          [470, 335],
          [365, 150],
          [365, 520],
          [850, 335],
        ];
  else if (n === 3)
    positions = portrait
      ? [
          [220, 200],
          [510, 420],
          [230, 650],
        ]
      : [
          [300, 190],
          [800, 335],
          [310, 505],
        ];
  else if (n <= 6)
    positions = portrait
      ? [
          [180, 150],
          [510, 150],
          [345, 325],
          [345, 500],
          [180, 690],
          [510, 690],
        ].slice(0, n)
      : [
          [180, 190],
          [180, 470],
          [390, 330],
          [710, 330],
          [920, 190],
          [920, 470],
        ].slice(0, n);
  else
    positions = level.nodes.map((_, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / n;
      return [
        w / 2 + Math.cos(angle) * (portrait ? 265 : 425),
        h / 2 + Math.sin(angle) * (portrait ? 320 : 240),
      ];
    });
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
    const offset = (index - (same.length - 1) / 2) * 100;
    const c = { x: (a.x + b.x) / 2 + nx * offset * 2, y: (a.y + b.y) / 2 + ny * offset * 2 };
    const point = (t) => ({
      x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
      y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
    });
    const samples = Array.from({ length: 33 }, (_, i) => point(i / 32));
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
