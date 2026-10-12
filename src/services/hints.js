import { remainingGraph, components, degrees } from '../model/graph.js';
import { residualFeasibility, targetEnd } from '../model/rules.js';
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
    return {
      kind: 'start',
      nodes: Object.entries(degrees(graph))
        .filter(([, d]) => d % 2)
        .map(([id]) => id),
    };
  }
  if (tier === 2) return { kind: 'pair', odd: possible.odd ?? [], groups: groups.length };
  const route = eulerRoute(remaining, run.currentNode, targetEnd(graph, run));
  return { kind: 'next', edge: route?.edges[0] };
}
