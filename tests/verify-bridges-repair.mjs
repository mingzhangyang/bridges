import test from 'node:test';
import assert from 'node:assert/strict';
import { allLevels, getLevel } from '../src/content/levels.js';
import { applyEdits, repairSolution } from '../src/model/repair.js';
import { replay } from '../src/services/replay.js';
// Independent DFS route existence, without Euler degree criteria or Hierholzer.
function canWalk(g, start, end) {
  function visit(n, mask) {
    if (mask === (1 << g.edges.length) - 1) return !end || end === n;
    for (let i = 0; i < g.edges.length; i++) {
      const e = g.edges[i];
      if (
        !(mask & (1 << i)) &&
        (e.u === n || e.v === n) &&
        visit(e.u === n ? e.v : e.u, mask | (1 << i))
      )
        return true;
    }
    return false;
  }
  return visit(start, 0);
}
for (const l of allLevels.filter((l) => l.kind === 'repair'))
  test(`${l.id}: minimum works proven by independent enumeration`, () => {
    const solved = repairSolution(l);
    assert.ok(solved);
    let minimum = Infinity;
    for (let m = 0; m < 2 ** l.candidateEdits.length; m++) {
      const ids = l.candidateEdits.filter((_, i) => m & (1 << i)).map((e) => e.id);
      try {
        const { graph, cost } = applyEdits(l, ids);
        if (cost >= minimum) continue;
        for (const n of graph.nodes) {
          if (l.fixedStart && n.id !== l.fixedStart) continue;
          if (canWalk(graph, n.id, l.objective === 'return' ? n.id : l.fixedEnd)) {
            minimum = cost;
            break;
          }
        }
      } catch {}
    }
    assert.equal(solved.cost, minimum);
    const { graph } = applyEdits(l, solved.ids);
    assert.ok(
      replay(graph, solved.route.start, solved.route.edges, {
        complete: true,
        end: solved.route.end,
      }),
    );
  });
test('exact SB25 and SB32 design witnesses', () => {
  const l = getLevel('SB25'),
    g = applyEdits(l, ['BC1']).graph;
  assert.ok(
    replay(g, 'A', ['AB1', 'AB2', 'AC1', 'BC1', 'BD', 'CD', 'AC2', 'AD'], {
      complete: true,
      end: 'D',
    }),
  );
  const final = applyEdits(getLevel('SB32'), ['BC1', 'AD2']).graph;
  assert.ok(
    replay(final, 'A', ['AB1', 'AB2', 'AC1', 'BC1', 'BD', 'CD', 'AC2', 'AD', 'AD2'], {
      complete: true,
      end: 'A',
    }),
  );
});
test('budget, protected bridges, duplicate edits and service area isolation cannot be bypassed', () => {
  assert.throws(() => applyEdits(getLevel('SB25'), ['BC1', 'AD2']));
  assert.throws(() => applyEdits(getLevel('SB31'), ['remove-b4']));
  assert.throws(() => applyEdits(getLevel('SB25'), ['BC1', 'BC1']));
  const l = {
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    edges: [
      { id: 'ab', u: 'A', v: 'B' },
      { id: 'bc', u: 'B', v: 'C' },
    ],
    requiredNodes: ['A', 'B', 'C'],
    budget: 2,
    candidateEdits: [
      { id: 'r', kind: 'remove', edgeId: 'bc' },
      { id: 's', kind: 'remove', edgeId: 'ab' },
    ],
  };
  assert.throws(() => applyEdits(l, ['r']));
  assert.throws(() => applyEdits(l, ['r', 's']));
});

test('remove/add cancellation cannot manufacture an edit or reward', () => {
  const l = {
    nodes: [{ id: 'A' }, { id: 'B' }],
    edges: [{ id: 'ab', u: 'A', v: 'B' }],
    budget: 2,
    candidateEdits: [
      { id: 'remove', kind: 'remove', edgeId: 'ab' },
      { id: 'add', kind: 'add', edge: { id: 'ab', u: 'A', v: 'B' } },
    ],
  };
  assert.throws(() => applyEdits(l, ['remove', 'add']));
});
