import test from 'node:test';
import assert from 'node:assert/strict';
import { allLevels } from '../src/content/levels.js';
import { geometry } from '../src/render/geometry.js';
import { beginTrace, advanceTrace } from '../src/input/bridge-trace.js';
import { placeNames } from '../src/render/city.js';

for (const portrait of [false, true]) {
  test(`Every built and candidate corridor clears unrelated waterfronts (${portrait ? 'portrait' : 'landscape'})`, () => {
    for (const level of allLevels) {
      const geo = geometry(level, portrait);
      const edges = [
        ...level.edges,
        ...(level.candidateEdits ?? []).filter((e) => e.kind === 'add').map((e) => e.edge),
      ];
      for (const edge of edges)
        for (let i = 0; i <= 256; i++) {
          const p = geo.curves[edge.id].point(i / 256);
          assert.ok(
            p.x >= 20 && p.x <= geo.w - 20 && p.y >= 20 && p.y <= geo.h - 20,
            `${level.id}/${edge.id} bounds`,
          );
          for (const node of level.nodes.filter((n) => n.id !== edge.u && n.id !== edge.v)) {
            const q = geo.nodes[node.id];
            // Terrain (72 × 47), bridge width and a waterfront clearance margin.
            assert.ok(
              Math.hypot((p.x - q.x) / 92, (p.y - q.y) / 68) >= 1,
              `${level.id}/${edge.id} crosses ${node.id}`,
            );
          }
        }
    }
  });
  test(`Every bridge can be traced from either end without changing identity (${portrait ? 'portrait' : 'landscape'})`, () => {
    for (const level of allLevels) {
      const geo = geometry(level, portrait);
      const edges = [
        ...level.edges,
        ...(level.candidateEdits ?? []).filter((e) => e.kind === 'add').map((e) => e.edge),
      ];
      for (const edge of edges)
        for (const node of [edge.u, edge.v]) {
          let trace = beginTrace(
            geo,
            edges.filter((e) => e.u === node || e.v === node),
            node,
            geo.nodes[node],
          );
          const curve = geo.curves[edge.id],
            reverse = curve.canonical[1] === node;
          for (let i = 1; i <= 64 && !trace.complete; i++)
            trace = advanceTrace(trace, curve.point(reverse ? 1 - i / 64 : i / 64), geo);
          assert.equal(trace.complete?.id, edge.id, `${level.id}/${edge.id} from ${node}`);
        }
    }
  });
}
test('A drag leaving every corridor cannot join a different bridge at a crossing', () => {
  const level = allLevels[0],
    geo = geometry(level, true);
  let trace = beginTrace(geo, level.edges, 'A', geo.nodes.A);
  trace = advanceTrace(trace, { x: 20, y: 20 }, geo);
  trace = advanceTrace(trace, geo.nodes.B, geo);
  assert.equal(trace.complete, undefined);
  assert.deepEqual(trace.candidates, []);
});
test('Island names never sit on a bridge deck, another island or another name', () => {
  for (const level of allLevels)
    for (const portrait of [false, true])
      for (const lang of ['zh', 'en'])
        for (const counts of [false, true]) {
          const geo = geometry(level, portrait),
            names = placeNames(level, geo, lang, counts);
          // clear is the gap past a bridge's railing; a 7 px deck half-width stays free.
          for (const [id, name] of Object.entries(names))
            assert.ok(
              name.clear >= -7,
              `${level.id} ${portrait ? 'portrait' : 'landscape'} ${lang}${counts ? ' counts' : ''}: ${id}`,
            );
        }
});
test('Every bridge lands on the quays of both its islands', () => {
  for (const level of allLevels)
    for (const portrait of [false, true]) {
      const geo = geometry(level, portrait);
      for (const curve of Object.values(geo.curves)) {
        const [from, to] = curve.ends;
        assert.ok(from.t > 0 && from.t < to.t && to.t < 1);
        for (const [end, node] of [
          [from, curve.a],
          [to, curve.b],
        ])
          assert.ok(
            Math.abs(((end.x - node.x) / 66) ** 2 + ((end.y - node.y) / 42) ** 2 - 1) < 0.01,
          );
      }
    }
});
