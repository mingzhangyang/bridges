import { hits, distance, sweep } from './bridge-hit-test.js';
import { otherEnd } from '../model/graph.js';

// Retain every corridor consistent with the whole gesture. Crossing another bridge later
// cannot switch its identity, and parallel entrances may separate beyond the first portal.
export function beginTrace(geo, edges, node, start) {
  const origin = geo.nodes[node];
  if (!origin || distance(start, origin) > 46) return null;
  return { node, origin, candidates: edges, last: start, excursion: 0 };
}
export function advanceTrace(trace, point, geo) {
  if (!trace) return null;
  let next = { ...trace };
  for (const sample of sweep(trace.last, point)) {
    next.excursion = Math.max(next.excursion, distance(sample, next.origin));
    if (distance(sample, next.origin) > 38)
      next.candidates = hits(sample, geo, next.candidates, 30);
    const arrived = traceArrivals(next, sample, geo);
    if (next.candidates.length === 1 && arrived.length === 1)
      return { ...next, last: sample, complete: arrived[0] };
  }
  return { ...next, last: point };
}
export function traceArrivals(trace, point, geo) {
  if (!trace || trace.excursion <= 60) return [];
  return trace.candidates.filter(
    (edge) => distance(point, geo.nodes[otherEnd(edge, trace.node)]) < 35,
  );
}
