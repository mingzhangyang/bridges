import { hits, distance } from './bridge-hit-test.js';
import { beginTrace, advanceTrace, traceArrivals } from './bridge-trace.js';
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
      moved: false,
      committed: false,
      trace: null,
      node: e.target.closest('[data-node]')?.dataset.node ?? null,
    };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const p = point(e);
    if (!p) return;
    if (distance(p, gesture.start) > 10) gesture.moved = true;
    const { geo, graph, run, locked, walkable } = state();
    if (p.x < 0 || p.y < 0 || p.x > geo.w || p.y > geo.h) {
      gesture = null;
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      return;
    }
    if (!locked && gesture.moved && run.currentNode) {
      gesture.trace ??= beginTrace(
        geo,
        graph.edges.filter((edge) => walkable(edge.id)),
        run.currentNode,
        gesture.start,
      );
      gesture.trace = advanceTrace(gesture.trace, p, geo);
      if (gesture.trace?.complete) {
        const edge = gesture.trace.complete,
          destination = edge.u === gesture.trace.node ? edge.v : edge.u;
        // Finish the local transition before calling out: submit may update the run
        // in place, replace it, or cancel this gesture during a scene change.
        gesture.committed = true;
        gesture.trace = null;
        gesture.start = geo.nodes[destination];
        submit(edge.id);
      }
    }
  });
  stage.addEventListener('pointerup', (e) => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture;
    gesture = null;
    stage.releasePointerCapture(e.pointerId);
    const { geo, graph, canSelectNode, actionable, locked } = state(),
      p = point(e);
    if (!p) return;
    if (g.moved || g.committed) {
      if (!locked) {
        // A release may arrive without a final move event. Sweep it just like a move
        // before accepting either a unique crossing or an ambiguous bridge choice.
        const trace = advanceTrace(g.trace, p, geo);
        const arrived = trace?.complete ? [trace.complete] : traceArrivals(trace, p, geo);
        if (arrived.length > 1) choose(arrived);
        else if (arrived.length === 1) submit(arrived[0].id);
      }
      return;
    }
    // Capture retargets pointerup to the stage. Preserve the pressed island explicitly; an island
    // that cannot be chosen now lets the press fall through to the bridge ends drawn over it.
    const node =
      g.node && canSelectNode(g.node) && distance(p, geo.nodes[g.node]) <= 43 ? g.node : null;
    if (node) {
      selectNode(node);
      return;
    }
    const svg = stage.querySelector('svg'),
      // The SVG viewport can be letterboxed when height limits the scene. Its
      // screen transform includes that fitted scale, unlike the element width.
      matrix = svg.getScreenCTM(),
      radius = 22 / Math.hypot(matrix.a, matrix.b);
    const found = hits(p, geo, graph.edges, radius),
      open = found.filter((e) => actionable(e.id));
    // Only bridges that can be acted on compete for an overlapping tap; with none, the first hit
    // still explains why it is closed.
    if (open.length > 1) choose(open);
    else if (open.length === 1) submit(open[0].id);
    else if (found.length) submit(found[0].id);
  });
  const cancel = () => {
    gesture = null;
  };
  stage.addEventListener('pointercancel', cancel);
  stage.addEventListener('lostpointercapture', cancel);
  return cancel;
}
