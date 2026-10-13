import test from 'node:test';
import assert from 'node:assert/strict';
import { allLevels, levels, commissions, getLevel, nodeNames } from '../src/content/levels.js';
import { eulerRoute } from '../src/model/euler.js';
import { replay } from '../src/services/replay.js';
import { geometry } from '../src/render/geometry.js';
test('campaign and commissions are complete and stable', () => {
  assert.equal(levels.length, 32);
  assert.equal(commissions.length, 8);
  assert.equal(levels.filter((l) => l.kind === 'discovery').length, 1);
  assert.equal(new Set(allLevels.map((l) => l.id)).size, 40);
});
// Titles may only name islands that are on the map, and "X to Y" titles must match the endpoints.
// Island names come from the level data; aliases cover shortened forms used in titles.
const aliases = [
  [['quay'], ['B', 'C']],
  [['belfr'], ['G']],
  [['集市', '小市', 'market'], ['H']],
  [['灯塔'], ['A']],
];
const places = [
  ...Object.entries(nodeNames).map(([id, [zh, en]]) => [[zh, en.toLowerCase()], [id]]),
  ...aliases,
];
const named = (text) =>
  places
    .filter(([words]) => words.some((w) => text.toLowerCase().includes(w)))
    .map(([, ids]) => ids);
test('level titles name only islands on the map and agree with required endpoints', () => {
  for (const l of allLevels) {
    const ids = l.nodes.map((n) => n.id);
    for (const text of l.title)
      for (const options of named(text))
        assert.ok(
          options.some((id) => ids.includes(id)),
          `${l.id} "${text}" names an island not on the map`,
        );
    for (const [text, sep] of [
      [l.title[0], '到'],
      [l.title[1], ' to '],
    ]) {
      const at = text.indexOf(sep);
      if (at < 0) continue;
      const [from] = named(text.slice(0, at)),
        [to] = named(text.slice(at + sep.length)),
        end = l.objective === 'return' ? l.fixedStart : l.fixedEnd;
      if (from) assert.ok(from.includes(l.fixedStart), `${l.id} "${text}" start`);
      if (to) assert.ok(to.includes(end), `${l.id} "${text}" destination`);
    }
  }
});
for (const l of allLevels.filter((l) => l.kind === 'walk'))
  test(`${l.id}: valid witness respects objectives`, () => {
    const r = eulerRoute(l, l.fixedStart, l.objective === 'return' ? l.fixedStart : l.fixedEnd);
    assert.ok(r);
    assert.ok(replay(l, r.start, r.edges, { complete: true, end: r.end }));
    if (l.objective === 'return') assert.equal(r.start, r.end);
  });
test('SB08 precise city structure and witness', () => {
  const l = getLevel('SB08');
  assert.ok(
    replay(l, 'C', ['b3', 'b1', 'b2', 'b7', 'b4', 'b5', 'b6'], { complete: true, end: 'D' }),
  );
});
for (const portrait of [false, true])
  test(`all bridge geometry is finite and inside the ${portrait ? 'portrait' : 'landscape'} map`, () => {
    for (const l of allLevels) {
      const g = geometry(l, portrait);
      for (const curve of Object.values(g.curves))
        for (const p of curve.samples) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
          assert.ok(
            p.x >= 20 && p.x <= g.w - 20 && p.y >= 20 && p.y <= g.h - 20,
            `${l.id}: ${JSON.stringify(p)}`,
          );
        }
    }
  });
