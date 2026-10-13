// A local pairing is an illustration, not a proposed global route. Preserve edge IDs,
// especially for parallel bridges: each endpoint belongs to exactly one pair or remainder.
export function islandPairings(graph) {
  return graph.nodes.map((node) => {
    const ends = graph.edges
      .filter((edge) => edge.u === node.id || edge.v === node.id)
      .map((e) => e.id);
    const pairs = [];
    for (let i = 0; i + 1 < ends.length; i += 2) pairs.push(ends.slice(i, i + 2));
    return { node: node.id, pairs, unpaired: ends.length % 2 ? ends.at(-1) : null };
  });
}
