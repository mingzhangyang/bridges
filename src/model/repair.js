import { validateGraph, degrees, components } from './graph.js';
import { eulerRoute, feasibility } from './euler.js';
import { replay } from '../services/replay.js';
export function previewBlueprint(level, ids) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) throw new Error('Duplicate edits');
  const candidates = level.candidateEdits ?? [];
  if (new Set(candidates.map((e) => e.id)).size !== candidates.length)
    throw new Error('Duplicate edit slots');
  let edges = [...level.edges],
    cost = 0;
  for (const id of ids) {
    const edit = level.candidateEdits?.find((e) => e.id === id);
    if (!edit) throw new Error('Unknown edit');
    const unitCost = edit.cost ?? 1;
    if (!Number.isInteger(unitCost) || unitCost < 1) throw new Error('Invalid cost');
    cost += unitCost;
    if (edit.kind === 'add') {
      if (
        level.edges.some((e) => e.id === edit.edge.id) ||
        edges.some((e) => e.id === edit.edge.id)
      )
        throw new Error('Existing bridge');
      edges.push(edit.edge);
    } else if (edit.kind === 'remove') {
      if (
        (level.protectedEdges ?? []).includes(edit.edgeId) ||
        !level.edges.some((e) => e.id === edit.edgeId) ||
        !edges.some((e) => e.id === edit.edgeId)
      )
        throw new Error('Protected or missing bridge');
      edges = edges.filter((e) => e.id !== edit.edgeId);
    } else throw new Error('Invalid edit');
  }
  if (cost > (level.budget ?? 0)) throw new Error('Over budget');
  const graph = validateGraph({ ...level, edges });
  return { graph, cost };
}
export function applyEdits(level, ids) {
  const { graph, cost } = previewBlueprint(level, ids);
  if (!graph.edges.length || (level.requiredNodes ?? []).some((n) => !degrees(graph)[n]))
    throw new Error('Unserved area');
  if (components(graph).length !== 1) throw new Error('Disconnected service areas');
  const possible = feasibility(
    graph,
    level.fixedStart,
    level.objective === 'return' ? level.fixedStart : level.fixedEnd,
  );
  if (!possible.ok || (level.objective === 'return' && possible.start !== possible.end))
    throw new Error('Unwalkable objective');
  return { graph, cost };
}
export function repairSolution(level) {
  const edits = level.candidateEdits ?? [];
  if (edits.length > 12 || level.budget > 3) throw new Error('Search bounds exceeded');
  let best = null;
  for (let mask = 0; mask < 2 ** edits.length; mask++) {
    const ids = edits.filter((_, i) => mask & (1 << i)).map((e) => e.id);
    try {
      const { graph, cost } = applyEdits(level, ids);
      if (best && cost >= best.cost) continue;
      const start = level.fixedStart,
        end = level.objective === 'return' ? start : level.fixedEnd;
      // Return objectives without a fixed start must still request a circuit.
      const route = eulerRoute(graph, start, end);
      if (!route || (level.objective === 'return' && route.start !== route.end)) continue;
      if (replay(graph, route.start, route.edges, { complete: true, end: route.end }))
        best = { ids, cost, route };
    } catch {
      /* Invalid final blueprints are not solutions. */
    }
  }
  return best;
}
