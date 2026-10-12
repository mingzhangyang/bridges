import { hits, sweep, distance } from './bridge-hit-test.js';
import { otherEnd } from '../model/graph.js';
export function attachPointer(stage, state, submit, selectNode, choose) {
  let gesture = null;
  const point = (e) => {
    const svg = stage.querySelector('svg');
    if (!svg) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  };
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const p = point(e);
    if (!p) return;
    gesture = {
      id: e.pointerId,
      start: p,
      last: p,
      moved: false,
      committed: false,
      edge: null,
      progress: 0,
      node: e.target.closest('[data-node]')?.dataset.node ?? null,
    };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const p = point(e);
    if (!p) return;
    if (distance(p, gesture.start) > 10) gesture.moved = true;
    const { geo, graph, run, locked } = state();
    if (p.x < 0 || p.y < 0 || p.x > geo.w || p.y > geo.h) {
      gesture = null;
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      return;
    }
    if (!locked && gesture.moved && run.currentNode && run.phase !== 'planning') {
      const origin = geo.nodes[run.currentNode];
      for (const q of sweep(gesture.last, p)) {
        if (!gesture.edge) {
          if (distance(gesture.start, origin) > 46) break;
          const candidates = hits(
            q,
            geo,
            graph.edges.filter(
              (edge) => otherEnd(edge, run.currentNode) && !run.walkedEdgeIds.includes(edge.id),
            ),
          );
          // Wait until separated corridors identify exactly one bridge. Never guess at overlap.
          if (candidates.length === 1 && distance(q, origin) > 38 && distance(q, origin) < 75)
            gesture.edge = candidates[0];
        } else {
          const curve = geo.curves[gesture.edge.id],
            inside = hits(q, geo, [gesture.edge], 30).length;
          if (!inside) {
            gesture.edge = null;
            break;
          }
          gesture.progress = Math.max(gesture.progress, distance(q, origin));
          const destination = geo.nodes[otherEnd(gesture.edge, run.currentNode)];
          if (distance(q, destination) < 35 && gesture.progress > 60) {
            gesture.committed = true;
            submit(gesture.edge.id);
            gesture.edge = null;
            gesture.start = destination;
            gesture.progress = 0;
            break;
          }
        }
      }
    }
    gesture.last = p;
  });
  stage.addEventListener('pointerup', (e) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture;
    gesture = null;
    stage.releasePointerCapture(e.pointerId);
    if (g.moved || g.committed) return;
    const { geo, graph } = state(),
      p = point(e);
    if (!p) return;
    // Capture retargets pointerup to the stage. Preserve the pressed island explicitly.
    const node = g.node && distance(p, geo.nodes[g.node]) <= 43 ? g.node : null;
    if (node) {
      selectNode(node);
      return;
    }
    const svg = stage.querySelector('svg'),
      radius = (22 * geo.w) / svg.getBoundingClientRect().width;
    const found = hits(p, geo, graph.edges, radius);
    if (found.length > 1) choose(found);
    else if (found.length === 1) submit(found[0].id);
  });
  const cancel = () => {
    gesture = null;
  };
  stage.addEventListener('pointercancel', cancel);
  stage.addEventListener('lostpointercapture', cancel);
  return cancel;
}
