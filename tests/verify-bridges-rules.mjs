import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGraph, degrees } from '../src/model/graph.js';
import { eulerRoute, feasibility } from '../src/model/euler.js';
import { replay } from '../src/services/replay.js';
import { newRun, move, undo, restoreRun } from '../src/model/commands.js';
import { residualFeasibility } from '../src/model/rules.js';
import { getLevel } from '../src/content/levels.js';
export function bruteRoute(graph, start, end) {
  function visit(node, ids) {
    if (ids.length === graph.edges.length)
      return (!end || node === end) && graph.edges.length ? ids : null;
    for (const edge of graph.edges)
      if (!ids.includes(edge.id) && (edge.u === node || edge.v === node)) {
        const result = visit(edge.u === node ? edge.v : edge.u, [...ids, edge.id]);
        if (result) return result;
      }
    return null;
  }
  return visit(start, []);
}
test('Euler witnesses agree with exhaustive walks for every simple graph on four vertices and endpoint pair', () => {
  const pairs = ['AB', 'AC', 'AD', 'BC', 'BD', 'CD'];
  for (let mask = 1; mask < 64; mask++) {
    const graph = {
      nodes: ['A', 'B', 'C', 'D'].map((id) => ({ id })),
      edges: pairs
        .filter((_, i) => mask & (1 << i))
        .map((p, i) => ({ id: `e${i}`, u: p[0], v: p[1] })),
    };
    for (const start of ['A', 'B', 'C', 'D'])
      for (const end of [null, 'A', 'B', 'C', 'D']) {
        const expected = bruteRoute(graph, start, end),
          actual = eulerRoute(graph, start, end);
        assert.equal(!!actual, !!expected, `${mask}:${start}:${end}`);
        if (actual) assert.ok(replay(graph, start, actual.edges, { complete: true, end }));
      }
  }
});
test('historical graph has four odd islands and never completes as a walk', () => {
  const l = getLevel('SB24');
  assert.deepEqual(degrees(l), { A: 5, B: 3, C: 3, D: 3 });
  assert.equal(feasibility(l).ok, false);
  for (const n of l.nodes) assert.equal(eulerRoute(l, n.id), null);
});
test('parallel bridges are separate and cannot be reused', () => {
  const l = getLevel('SB03');
  let r = newRun(l);
  r = move(l, r, 'b1').run;
  assert.equal(move(l, r, 'b1').error, 'used');
  r = move(l, r, 'b2').run;
  assert.equal(r.currentNode, 'B');
  assert.equal(move(l, r, 'b3').run.phase, 'complete');
});
test('two disconnected even cycles are infeasible', () => {
  const l = getLevel('SB27');
  assert.equal(feasibility(l).reason, 'disconnected');
});
test('wrong fixed start/end and final residual step are checked', () => {
  const l = getLevel('SB23');
  assert.equal(eulerRoute(l, 'B', 'D'), null);
  assert.equal(eulerRoute(l, 'A', 'C'), null);
  let r = newRun(l);
  const route = eulerRoute(l, 'A', 'D');
  for (const id of route.edges) r = move(l, r, id).run;
  assert.equal(r.phase, 'complete');
  assert.equal(residualFeasibility(l, r).ok, true);
  assert.equal(feasibility({ ...l, edges: [] }, 'A', 'D').ok, false);
});
test('early connector keeps dead end visible and undo recovers', () => {
  const l = getLevel('SB08');
  let r = { ...newRun(l), startNode: 'C', currentNode: 'C', history: ['C'] };
  r = move(l, r, 'b7').run;
  assert.equal(residualFeasibility(l, r).ok, false);
  r = undo(r);
  assert.equal(residualFeasibility(l, r).ok, true);
});
test('save restoration rebuilds location and history, rejects contradictory state', () => {
  const l = getLevel('SB01');
  const r = move(l, newRun(l), 'b1').run;
  assert.deepEqual(restoreRun(l, r).walkedEdgeIds, ['b1']);
  assert.equal(restoreRun(l, { ...r, currentNode: 'C' }), null);
  assert.equal(restoreRun(l, { ...r, history: ['A', 'C'] }), null);
  assert.equal(restoreRun(l, { ...r, walkedEdgeIds: ['b1', 'b1'] }), null);
  assert.equal(restoreRun(l, { ...r, levelRevision: 99 }), null);
  const odd = restoreRun(l, { ...r, hintTier: 'a', explained: 'yes' });
  assert.equal(odd.hintTier, 0);
  assert.equal(odd.explained, false);
  assert.equal(restoreRun(l, { ...r, hintTier: 2 }).hintTier, 2);
});
test('graph rejects self loops and ambiguous identifiers', () => {
  assert.throws(() =>
    validateGraph({ nodes: [{ id: 'A' }], edges: [{ id: 'a', u: 'A', v: 'A' }] }),
  );
  assert.throws(() => validateGraph({ nodes: [{ id: 'A' }, { id: 'A' }], edges: [] }));
  assert.throws(() =>
    validateGraph({ nodes: [{ id: 'A' }, { id: '' }], edges: [{ id: 'a', u: 'A', v: '' }] }),
  );
  assert.throws(() =>
    validateGraph({ nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ u: 'A', v: 'B' }] }),
  );
});

test('discovery phase and blueprint undo history survive restoration', () => {
  const historical = getLevel('SB24');
  const discovering = { ...newRun(historical), phase: 'discovery', discoveryNodes: ['A', 'B'] };
  assert.equal(restoreRun(historical, discovering).phase, 'discovery');
  const works = getLevel('SB32'),
    planning = { ...newRun(works), draftEdits: ['BC1'], editHistory: [[]] };
  assert.deepEqual(restoreRun(works, planning).editHistory, [[]]);
  const guarded = getLevel('SB31');
  assert.deepEqual(
    restoreRun(guarded, { ...newRun(guarded), editHistory: [['remove-b4']] }).editHistory,
    [],
  );
});
