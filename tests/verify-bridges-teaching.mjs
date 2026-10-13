import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/content/levels.js';
import { newRun, move } from '../src/model/commands.js';
import { hint } from '../src/services/hints.js';
import { islandPairings } from '../src/services/pairing.js';
import { residualFeasibility } from '../src/model/rules.js';

test('Second hint names the premature connector and the exact stranded bridges', () => {
  const level = getLevel('SB08');
  const run = { ...newRun(level), startNode: 'C', currentNode: 'C', history: ['C'] };
  const risk = hint(level, run, 2);
  assert.equal(risk.kind, 'risk');
  assert.equal(risk.edge, 'b7');
  assert.equal(risk.destination, 'D');
  assert.deepEqual(new Set(risk.ids), new Set(['b1', 'b2', 'b3']));
  assert.equal(residualFeasibility(level, move(level, run, risk.edge).run).ok, false);
  let cleared = run;
  for (const id of ['b3', 'b1', 'b2']) cleared = move(level, cleared, id).run;
  assert.equal(hint(level, cleared, 2).kind, 'choicesSafe');
  assert.equal(hint(level, cleared, 3).kind, 'next');
});
test('Two parallel bridges are not falsely presented as a dangerous connector', () => {
  const level = {
    id: 'parallel',
    nodes: [{ id: 'A' }, { id: 'B' }],
    edges: [
      { id: 'one', u: 'A', v: 'B' },
      { id: 'two', u: 'A', v: 'B' },
    ],
    fixedStart: 'A',
    objective: 'return',
  };
  assert.equal(hint(level, newRun(level), 2).kind, 'choicesSafe');
});
test('The historical lesson accounts for all fourteen real bridge ends exactly once', () => {
  const level = getLevel('SB24'),
    groups = islandPairings(level);
  assert.equal(groups.filter((g) => g.unpaired).length, 4);
  const allEnds = [];
  for (const group of groups) {
    const ids = [...group.pairs.flat(), group.unpaired].filter(Boolean);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(
      new Set(ids),
      new Set(level.edges.filter((e) => e.u === group.node || e.v === group.node).map((e) => e.id)),
    );
    allEnds.push(...ids);
  }
  assert.equal(allEnds.length, 14);
  for (const edge of level.edges) assert.equal(allEnds.filter((id) => id === edge.id).length, 2);
});
