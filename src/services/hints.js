import { remainingGraph, components, degrees, otherEnd } from '../model/graph.js';
import { residualFeasibility, targetEnd, availableEdges } from '../model/rules.js';
import { eulerRoute } from '../model/euler.js';
import { undo } from '../model/commands.js';
export function hint(graph, run, tier) {
  const remaining = remainingGraph(graph, run.walkedEdgeIds),
    groups = components(remaining);
  if (tier === 1)
    return {
      kind: 'remaining',
      ids: remaining.edges.map((e) => e.id),
      groups: groups.length,
      count: remaining.edges.length,
    };
  const possible = residualFeasibility(graph, run);
  if (!possible.ok) {
    let previous = run,
      steps = 0;
    while (previous.walkedEdgeIds.length) {
      previous = undo(previous);
      steps++;
      if (residualFeasibility(graph, previous).ok)
        return {
          kind: 'rewind',
          steps,
          index: previous.walkedEdgeIds.length,
          node: previous.currentNode,
        };
    }
    // Even the empty journey fails from this start: go back to the beginning to choose again.
    return {
      kind: 'start',
      steps,
      index: 0,
      nodes: Object.entries(degrees(graph))
        .filter(([, d]) => d % 2)
        .map(([id]) => id),
    };
  }
  if (tier === 2) {
    for (const edge of availableEdges(graph, run)) {
      const destination = otherEnd(edge, run.currentNode);
      const after = remainingGraph(remaining, [edge.id]);
      const stranded = components(after)
        .filter((group) => !group.includes(destination))
        .flat();
      const ids = after.edges.filter((e) => stranded.includes(e.u)).map((e) => e.id);
      if (ids.length) return { kind: 'risk', edge: edge.id, destination, nodes: stranded, ids };
    }
    return { kind: 'choicesSafe' };
  }
  const route = eulerRoute(remaining, run.currentNode, targetEnd(graph, run));
  return { kind: 'next', edge: route?.edges[0] };
}
