import { otherEnd } from './graph.js';
// The single answer to "what can the player act on right now?". Rendering (roles, focus,
// styling, accessible names), pointer, keyboard and command handlers all read it, so an
// element is never presented as actionable when its handler would do nothing.
const walkPhase = (run) => ['walking', 'stuck'].includes(run.phase);
export function candidateFor(level, edgeId) {
  return (level.candidateEdits ?? []).find((e) =>
    e.kind === 'add' ? e.edge.id === edgeId : e.edgeId === edgeId,
  );
}
export const isProtected = (level, edgeId) => (level.protectedEdges ?? []).includes(edgeId);
// Bridges drawn on the map: the blueprint shows candidate slots while planning.
export function visibleEdges(level, graph, run) {
  return run.phase === 'planning'
    ? [
        ...level.edges,
        ...(level.candidateEdits ?? []).filter((e) => e.kind === 'add').map((e) => e.edge),
      ]
    : graph.edges;
}
export function bridgeAction(level, graph, run, edgeId) {
  if (run.phase === 'planning') {
    const edit = candidateFor(level, edgeId);
    return edit && !(edit.kind === 'remove' && isProtected(level, edit.edgeId)) ? 'edit' : null;
  }
  if (!walkPhase(run) || !run.currentNode || run.walkedEdgeIds.includes(edgeId)) return null;
  const edge = graph.edges.find((e) => e.id === edgeId);
  return edge && otherEnd(edge, run.currentNode) ? 'walk' : null;
}
export function actionableBridges(level, graph, run) {
  return visibleEdges(level, graph, run)
    .map((e) => e.id)
    .filter((id) => bridgeAction(level, graph, run, id));
}
// The state every bridge announces; it mirrors what the map draws for that bridge.
export function bridgeState(level, graph, run, edgeId) {
  if (run.phase === 'planning') {
    const edit = candidateFor(level, edgeId);
    if (isProtected(level, edgeId)) return 'protected';
    if (!edit) return 'fixed';
    const built = run.draftEdits.includes(edit.id);
    if (edit.kind === 'add') return built ? 'plannedAdd' : 'canAdd';
    return built ? 'plannedRemove' : 'canRemove';
  }
  if (run.walkedEdgeIds.includes(edgeId)) return 'used';
  return bridgeAction(level, graph, run, edgeId) === 'walk' ? 'available' : 'unused';
}
export function nodeAction(level, run, nodeId) {
  if (!level.nodes.some((n) => n.id === nodeId)) return null;
  if (run.phase === 'discovery') return 'toggle';
  if (walkPhase(run) && !run.walkedEdgeIds.length && !level.fixedStart) return 'start';
  return null;
}
