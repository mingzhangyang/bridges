// Deck details follow the same curve as input and walking. They are decoration only:
// no additional bridge silhouettes, endpoints or hit areas are introduced.
export function bridgeSurface(curve, material = 'wood') {
  const [start, end] = curve.ends;
  const points = curve.samples;
  const length = points
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
  const count = Math.max(
    2,
    Math.ceil((length * (end.t - start.t)) / (material === 'wood' ? 13 : 24)),
  );
  const at = (fraction, offset = 0) => {
    const t = start.t + (end.t - start.t) * fraction;
    const p = curve.point(t);
    const dx = 2 * ((1 - t) * (curve.c.x - curve.a.x) + t * (curve.b.x - curve.c.x));
    const dy = 2 * ((1 - t) * (curve.c.y - curve.a.y) + t * (curve.b.y - curve.c.y));
    const norm = Math.hypot(dx, dy);
    return `${(p.x - (dy / norm) * offset).toFixed(1)},${(p.y + (dx / norm) * offset).toFixed(1)}`;
  };
  let joints = '',
    braces = '',
    rivets = '';
  for (let i = 1; i < count; i++) {
    const t = i / count;
    if (material === 'stone') {
      // Alternating half-width joints create two staggered rows of masonry.
      joints += `M${at(t, i % 2 ? -6 : 0)}L${at(t, i % 2 ? 0 : 6)}`;
    } else if (material === 'iron') {
      for (const side of [-1, 1]) {
        braces += `M${at((i - 1) / count, side * 8)}L${at(t, side * 4)}L${at(t, side * 8)}`;
        const [cx, cy] = at(t, side * 8).split(',');
        rivets += `<circle cx="${cx}" cy="${cy}" r="1.5"/>`;
      }
    } else joints += `M${at(t, -6)}L${at(t, 6)}`;
  }
  if (material === 'iron')
    return `<g class="material-detail" pointer-events="none"><path d="${braces}" fill="none" stroke="#435e65" stroke-width="1.7"/><g fill="#e4e9d9">${rivets}</g></g>`;
  const seam =
    material === 'stone'
      ? `<path d="${curve.path}" fill="none" stroke="#9b927b" stroke-width="1"/>`
      : '';
  return `<g class="material-detail" pointer-events="none">${seam}<path d="${joints}" fill="none" stroke="${material === 'stone' ? '#9b927b' : '#7d6548'}" stroke-width="1.2" opacity=".75"/></g>`;
}
