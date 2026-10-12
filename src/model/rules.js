import { remainingGraph, otherEnd, degrees } from './graph.js';
import { feasibility } from './euler.js';
import { replay } from '../services/replay.js';
export const targetEnd = (level, run) =>
  level.objective === 'return' ? run.startNode : level.fixedEnd;
export function routeComplete(graph, run) {
  return (
    graph.kind !== 'discovery' &&
    !!replay(graph, run.startNode, run.walkedEdgeIds, {
      complete: true,
      end: targetEnd(graph, run),
    })
  );
}
export function availableEdges(graph, run) {
  return graph.edges.filter(
    (e) => !run.walkedEdgeIds.includes(e.id) && otherEnd(e, run.currentNode),
  );
}
export function residualFeasibility(graph, run) {
  return feasibility(
    remainingGraph(graph, run.walkedEdgeIds),
    run.currentNode,
    targetEnd(graph, run),
  );
}

export function discoveryComplete(graph, run) {
  const odd = Object.entries(degrees(graph))
    .filter(([, d]) => d % 2)
    .map(([id]) => id);
  return (
    graph.kind === 'discovery' &&
    run.explained === true &&
    Array.isArray(run.discoveryNodes) &&
    new Set(run.discoveryNodes).size === 4 &&
    odd.length === 4 &&
    odd.every((id) => run.discoveryNodes.includes(id))
  );
}
