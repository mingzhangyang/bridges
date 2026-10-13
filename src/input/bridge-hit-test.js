export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
export function hits(point, geo, edges, radius = 22) {
  return edges.filter((e) => {
    const s = geo.curves[e.id]?.samples ?? [];
    return s.slice(1).some((b, i) => segmentDistance(point, s[i], b) <= radius);
  });
}
// Subdivide the segment, including endpoint samples, so sparse events cannot jump a corridor.
export function sweep(a, b, step = 8) {
  const n = Math.max(1, Math.ceil(distance(a, b) / step));
  return Array.from({ length: n }, (_, i) => ({
    x: a.x + ((b.x - a.x) * (i + 1)) / n,
    y: a.y + ((b.y - a.y) * (i + 1)) / n,
  }));
}
