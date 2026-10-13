import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeProgress,
  resolveSavedSelection,
  resolveSaveKey,
  levelUnlocked,
  chapterUnlocked,
} from '../src/services/progress.js';
import { emptySnapshot, recordCompletion } from '../src/storage.js';
import { getLevel } from '../src/content/levels.js';
import { newRun, move } from '../src/model/commands.js';
import { eulerRoute } from '../src/model/euler.js';
test('unverified witnesses, false discovery stamps and mismatched costs cannot unlock cities', () => {
  let s = emptySnapshot();
  const l = getLevel('SB01');
  let r = newRun(l);
  for (const id of ['b1', 'b2', 'b3']) r = move(l, r, id).run;
  s = recordCompletion(s, 'SB01', l, r);
  s.completions.SB02 = { independent: { ...s.completions.SB01.independent, edges: ['b4'] } };
  s.completions.SB03 = { independent: { ...s.completions.SB01.independent, cost: -1 } };
  s.completions.SB24 = {
    independent: {
      ...s.completions.SB01.independent,
      edges: [],
      discoveryNodes: ['A', 'B', 'C', 'D'],
      explained: true,
    },
  };
  s.discoveries.SB24 = {
    independent: {
      ...s.completions.SB01.independent,
      edges: [],
      discoveryNodes: ['A', 'B'],
      explained: true,
    },
  };
  const clean = sanitizeProgress(s);
  assert.ok(clean.completions.SB01.independent);
  assert.equal(clean.completions.SB02, undefined);
  assert.equal(clean.completions.SB03, undefined);
  assert.equal(clean.completions.SB24, undefined);
  assert.equal(clean.discoveries.SB24, undefined);
  assert.equal(chapterUnlocked(clean, 2), false);
});

test('save-key resolution checks daily type, shape, and frozen revision before lookup', () => {
  const walk = resolveSavedSelection('daily:2026-10-12:1:walk');
  assert.equal(walk.level.id, 'SB01');
  assert.equal(walk.entry.date, '2026-10-12');
  assert.equal(resolveSaveKey(walk.key), walk.level);
  const weekend = resolveSavedSelection('daily:2026-10-17:1:repair');
  assert.equal(weekend.entry.date, '2026-10-17');
  assert.equal(weekend.level.kind, 'repair');
  assert.deepEqual(resolveSavedSelection('SB10'), {
    level: getLevel('SB10'),
    key: 'SB10',
    entry: null,
  });
  for (const invalid of [
    null,
    12,
    'SB99',
    'daily:2026-10-12:1:constructor',
    'daily:2026-10-12:1:__proto__',
    'daily:2026-10-12:1:toString',
    'daily:2026-10-12:1:walk:extra',
    'daily:2026-10-12:2:walk',
    'daily:2026-10-12:1:repair',
    'daily:2026-10-12:1',
  ]) {
    assert.equal(resolveSavedSelection(invalid), null, String(invalid));
    assert.equal(resolveSaveKey(invalid), null, String(invalid));
  }
});

test('level access requires verified chapter witnesses, except for commissions', () => {
  let snapshot = emptySnapshot();
  assert.equal(levelUnlocked(snapshot, getLevel('SB01')), true);
  assert.equal(levelUnlocked(snapshot, getLevel('SB10')), false);
  assert.equal(levelUnlocked(snapshot, getLevel('EC07')), true);
  assert.equal(levelUnlocked(snapshot, null), false);
  snapshot.lastLevel = 'SB10';
  assert.equal(levelUnlocked(sanitizeProgress(snapshot), getLevel('SB10')), false);
  for (const id of ['SB01', 'SB02', 'SB03', 'SB04']) {
    const level = getLevel(id);
    const route = eulerRoute(level, level.fixedStart, level.fixedEnd);
    let run = {
      ...newRun(level),
      startNode: route.start,
      currentNode: route.start,
      history: [route.start],
    };
    for (const edge of route.edges) run = move(level, run, edge).run;
    snapshot = recordCompletion(snapshot, id, level, run);
  }
  assert.equal(levelUnlocked(sanitizeProgress(snapshot), getLevel('SB10')), true);
});
