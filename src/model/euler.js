import { degrees, components, otherEnd } from './graph.js';
// Start/end refer to the residual journey. A zero-edge journey is a real endpoint check.
export function feasibility(graph, start = graph.fixedStart, end = graph.fixedEnd) {
  const d = degrees(graph),
    odd = Object.keys(d).filter((n) => d[n] % 2);
  if (!graph.edges.length)
    return { ok: !!start && (!end || start === end), reason: 'endpoint', start };
  if (components(graph).length !== 1) return { ok: false, reason: 'disconnected', odd };
  if (odd.length !== 0 && odd.length !== 2) return { ok: false, reason: 'odd', odd };
  const chosen =
    start ??
    (end ? (odd.length === 2 ? odd.find((n) => n !== end) : end) : (odd[0] ?? graph.edges[0].u));
  if (!d[chosen]) return { ok: false, reason: 'isolated', odd };
  if (odd.length === 2 && !odd.includes(chosen)) return { ok: false, reason: 'start', odd };
  const finish = odd.length === 2 ? odd.find((n) => n !== chosen) : chosen;
  if (end && end !== finish) return { ok: false, reason: 'endpoint', odd };
  return { ok: true, start: chosen, end: finish, odd };
}
export function eulerRoute(graph, start, end) {
  const f = feasibility(graph, start, end);
  if (!f.ok) return null;
  const used = new Set(),
    stack = [{ node: f.start, edge: null }],
    reversed = [];
  while (stack.length) {
    const top = stack.at(-1),
      edge = graph.edges.find((e) => !used.has(e.id) && otherEnd(e, top.node));
    if (edge) {
      used.add(edge.id);
      stack.push({ node: otherEnd(edge, top.node), edge: edge.id });
    } else reversed.push(stack.pop());
  }
  return {
    start: f.start,
    end: f.end ?? f.start,
    edges: reversed
      .reverse()
      .slice(1)
      .map((p) => p.edge),
  };
}
