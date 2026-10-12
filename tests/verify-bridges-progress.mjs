import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProgress, chapterUnlocked } from '../src/services/progress.js';
import { emptySnapshot, recordCompletion } from '../src/storage.js';
import { getLevel } from '../src/content/levels.js';
import { newRun, move } from '../src/model/commands.js';
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
