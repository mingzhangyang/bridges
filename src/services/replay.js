// Independent edge-by-edge verifier; deliberately does not depend on the solver.
export function replay(graph, start, ids, { complete = false, end = null } = {}) {
  if (!graph.nodes.some((n) => n.id === start) || !Array.isArray(ids)) return null;
  const used = new Set(),
    visited = new Set([start]),
    history = [start];
  let current = start;
  for (const id of ids) {
    const edge = graph.edges.find((e) => e.id === id);
    if (!edge || used.has(id) || (edge.u !== current && edge.v !== current)) return null;
    current = edge.u === current ? edge.v : edge.u;
    used.add(id);
    visited.add(current);
    history.push(current);
  }
  if (
    complete &&
    (used.size !== graph.edges.length ||
      !used.size ||
      (end && current !== end) ||
      (graph.requiredNodes ?? []).some((n) => !visited.has(n)))
  )
    return null;
  return { current, history, visited: [...visited], used: [...used] };
}
