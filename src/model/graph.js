const isId = (id) => typeof id === 'string' && id !== '';
export function validateGraph(graph) {
  if (!graph.nodes.every((n) => isId(n.id)) || !graph.edges.every((e) => isId(e.id)))
    throw new Error('Duplicate or missing IDs');
  const nodes = new Set(graph.nodes.map((n) => n.id));
  const edges = new Set(graph.edges.map((e) => e.id));
  if (!nodes.size || nodes.size !== graph.nodes.length || edges.size !== graph.edges.length)
    throw new Error('Duplicate or missing IDs');
  for (const e of graph.edges)
    if (!nodes.has(e.u) || !nodes.has(e.v) || e.u === e.v) throw new Error('Invalid bridge');
  for (const id of graph.requiredNodes ?? [])
    if (!nodes.has(id)) throw new Error('Invalid service area');
  for (const id of [graph.fixedStart, graph.fixedEnd].filter(Boolean))
    if (!nodes.has(id)) throw new Error('Invalid endpoint');
  return graph;
}
export function degrees(graph) {
  const result = Object.fromEntries(graph.nodes.map((n) => [n.id, 0]));
  for (const e of graph.edges) {
    result[e.u]++;
    result[e.v]++;
  }
  return result;
}
export function components(graph) {
  const active = new Set(graph.edges.flatMap((e) => [e.u, e.v]));
  const groups = [];
  while (active.size) {
    const group = [active.values().next().value];
    active.delete(group[0]);
    for (let i = 0; i < group.length; i++)
      for (const e of graph.edges) {
        const next = e.u === group[i] ? e.v : e.v === group[i] ? e.u : null;
        if (active.has(next)) {
          active.delete(next);
          group.push(next);
        }
      }
    groups.push(group);
  }
  return groups;
}
export const otherEnd = (edge, node) =>
  edge.u === node ? edge.v : edge.v === node ? edge.u : null;
export const remainingGraph = (graph, walked) => ({
  ...graph,
  edges: graph.edges.filter((e) => !walked.includes(e.id)),
});
