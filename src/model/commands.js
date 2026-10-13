import { otherEnd } from './graph.js';
import { applyEdits, previewBlueprint, draftCost } from './repair.js';
import { routeComplete, availableEdges, discoveryComplete } from './rules.js';
import { replay } from '../services/replay.js';
// randomUUID exists only in secure contexts; getRandomValues also works over plain http (LAN).
function runId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function newRun(level, assistance = false) {
  return {
    levelId: level.id,
    levelRevision: level.revision,
    runId: runId(),
    finalEditSet: [],
    draftEdits: [],
    editHistory: [],
    startNode: level.fixedStart ?? null,
    currentNode: level.fixedStart ?? null,
    walkedEdgeIds: [],
    history: level.fixedStart ? [level.fixedStart] : [],
    assistance,
    phase: level.kind === 'repair' ? 'planning' : 'walking',
    discoveryNodes: [],
    explained: false,
  };
}
export function graphFor(level, run) {
  if (level.kind !== 'repair') return level;
  return run.phase === 'planning'
    ? previewBlueprint(level, run.draftEdits).graph
    : applyEdits(level, run.finalEditSet).graph;
}
export function chooseStart(level, run, node) {
  if (
    run.walkedEdgeIds.length ||
    !level.nodes.some((n) => n.id === node) ||
    (level.fixedStart && level.fixedStart !== node)
  )
    return run;
  return { ...run, startNode: node, currentNode: node, history: [node] };
}
export function move(graph, run, edgeId) {
  if (!['walking', 'stuck'].includes(run.phase) || !run.currentNode) return { run, error: 'start' };
  const edge = graph.edges.find((e) => e.id === edgeId),
    next = edge && otherEnd(edge, run.currentNode);
  if (run.walkedEdgeIds.includes(edgeId)) return { run, error: 'used' };
  if (!next) return { run, error: 'remote' };
  const updated = {
    ...run,
    currentNode: next,
    walkedEdgeIds: [...run.walkedEdgeIds, edgeId],
    history: [...run.history, next],
  };
  updated.phase = routeComplete(graph, updated)
    ? 'complete'
    : availableEdges(graph, updated).length
      ? 'walking'
      : 'stuck';
  return { run: updated };
}
export function undo(run) {
  if (!run.walkedEdgeIds.length) return run;
  const history = run.history.slice(0, -1);
  return {
    ...run,
    walkedEdgeIds: run.walkedEdgeIds.slice(0, -1),
    history,
    currentNode: history.at(-1),
    phase: 'walking',
  };
}
export function confirmBlueprint(level, run) {
  applyEdits(level, run.draftEdits);
  const fresh = newRun(level, run.assistance);
  return {
    ...fresh,
    phase: 'walking',
    finalEditSet: [...run.draftEdits],
    draftEdits: [...run.draftEdits],
  };
}
export function restoreRun(level, saved) {
  if (
    !saved ||
    saved.levelId !== level.id ||
    saved.levelRevision !== level.revision ||
    typeof saved.runId !== 'string' ||
    typeof saved.assistance !== 'boolean'
  )
    return null;
  if (
    !Array.isArray(saved.draftEdits) ||
    !Array.isArray(saved.finalEditSet) ||
    !Array.isArray(saved.walkedEdgeIds)
  )
    return null;
  try {
    const graph = graphFor(level, saved);
    // Drafts can be temporarily infeasible, but must use unique approved slots within budget.
    const candidates = level.candidateEdits ?? [];
    if (
      new Set(saved.draftEdits).size !== saved.draftEdits.length ||
      saved.draftEdits.some((id) => !candidates.some((e) => e.id === id)) ||
      draftCost(level, saved.draftEdits) > (level.budget ?? 0)
    )
      return null;
    if (level.fixedStart && saved.startNode !== level.fixedStart) return null;
    const result = saved.startNode
      ? replay(graph, saved.startNode, saved.walkedEdgeIds)
      : saved.walkedEdgeIds.length
        ? null
        : { current: null, history: [] };
    if (
      !result ||
      result.current !== saved.currentNode ||
      JSON.stringify(result.history) !== JSON.stringify(saved.history)
    )
      return null;
    const base = { ...newRun(level, saved.assistance), ...saved, history: result.history };
    if (saved.phase === 'planning') {
      if (level.kind !== 'repair' || saved.walkedEdgeIds.length) return null;
    } else if (discoveryComplete(level, saved)) base.phase = 'complete';
    else if (level.kind === 'discovery' && saved.phase === 'discovery') base.phase = 'discovery';
    else
      base.phase = routeComplete(graph, base)
        ? 'complete'
        : availableEdges(graph, base).length || !base.currentNode
          ? 'walking'
          : 'stuck';
    // The previous draft must remain available after reloading the planning phase.
    base.editHistory = Array.isArray(saved.editHistory)
      ? saved.editHistory
          .filter((ids) => {
            try {
              previewBlueprint(level, ids);
              return true;
            } catch {
              return false;
            }
          })
          .slice(-100)
      : [];
    base.hintTier = [1, 2, 3].includes(saved.hintTier) ? saved.hintTier : 0;
    base.explained = saved.explained === true;
    base.discoveryNodes = (saved.discoveryNodes ?? []).filter((n) =>
      level.nodes.some((v) => v.id === n),
    );
    return base;
  } catch {
    return null;
  }
}
