import test from 'node:test';
import assert from 'node:assert/strict';
import { manifest } from '../src/content/daily-manifest.js';
import { shanghaiDate, dailyEntry, dailyKey } from '../src/services/daily.js';
import { getLevel } from '../src/content/levels.js';
import { initialSettings } from '../src/services/settings.js';
import { emptySnapshot, storageAdapter, recordCompletion } from '../src/storage.js';
import { newRun, move } from '../src/model/commands.js';
import { hint } from '../src/services/hints.js';
import { sweep, hits } from '../src/input/bridge-hit-test.js';
import { geometry } from '../src/render/geometry.js';
test('366 offline dates are contiguous, with walk daily and repair on weekends only', () => {
  assert.equal(manifest.length, 366);
  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    assert.equal(getLevel(entry.walk).kind, 'walk');
    const day = new Date(entry.date).getUTCDay();
    assert.equal(!!entry.repair, [0, 6].includes(day));
    if (entry.repair) assert.equal(getLevel(entry.repair).kind, 'repair');
    if (i) assert.equal(new Date(entry.date) - new Date(manifest[i - 1].date), 86400000);
  }
});
test('daily UTC+8 boundary, frozen revisions and out-of-range handling', () => {
  assert.equal(shanghaiDate(new Date('2026-10-12T15:59:59Z')), '2026-10-12');
  assert.equal(shanghaiDate(new Date('2026-10-12T16:00:00Z')), '2026-10-13');
  const e = dailyEntry(new Date('2026-10-12T00:00Z'));
  assert.equal(dailyKey(e), 'daily:2026-10-12:1:walk');
  assert.equal(dailyEntry(new Date('2030-01-01')), null);
});
test('valid local settings override URL; mute is never imported', () => {
  assert.deepEqual(
    initialSettings({ lang: 'zh', theme: 'dark' }, '?lang=en&theme=light&muted=false'),
    { lang: 'zh', theme: 'dark', muted: true },
  );
  assert.deepEqual(initialSettings({}, '?lang=bad&theme=bad', 'en-US'), {
    lang: 'en',
    theme: 'light',
    muted: true,
  });
});
test('storage failures are explicit and recoverable', () => {
  const broken = storageAdapter(() => {
    throw new Error('Denied');
  });
  assert.equal(broken.read().version, 1);
  assert.equal(broken.trySet(emptySnapshot()), false);
  let raw = null;
  const adapter = storageAdapter(() => ({
    getItem: () => raw,
    setItem: (_, s) => {
      raw = s;
    },
  }));
  assert.equal(adapter.trySet(emptySnapshot()), true);
  assert.equal(adapter.read().version, 1);
  raw = '{';
  assert.equal(adapter.read().version, 1);
  assert.equal(adapter.failed, true);
});
test('independent and assisted seals remain separate; daily resets cannot erase assistance', () => {
  const l = getLevel('SB01');
  let r = newRun(l);
  for (const id of ['b1', 'b2', 'b3']) r = move(l, r, id).run;
  let s = recordCompletion(emptySnapshot(), l.id, l, r);
  const first = s.completions.SB01.independent.runId;
  s = recordCompletion(s, l.id, l, { ...r, runId: 'second', assistance: true });
  assert.equal(s.completions.SB01.independent.runId, first);
  assert.ok(s.completions.SB01.assisted);
  s.assistance.daily = true;
  s = recordCompletion(s, 'daily', l, { ...r, runId: 'third', assistance: false });
  assert.equal(s.completions.daily.independent, undefined);
  assert.ok(s.completions.daily.assisted);
  assert.equal(recordCompletion(s, 'daily', l, { ...r, runId: 'third' }), s);
});
test('hints on a doomed prefix return an actual recoverable fork', () => {
  const l = getLevel('SB08');
  let r = { ...newRun(l), startNode: 'C', currentNode: 'C', history: ['C'] };
  r = move(l, r, 'b7').run;
  const h = hint(l, r, 3);
  assert.equal(h.kind, 'rewind');
  assert.equal(h.index, 0);
  assert.equal(h.node, 'C');
});
test('sweep includes intermediate corridor samples and parallel hits remain distinct', () => {
  assert.ok(sweep({ x: 0, y: 0 }, { x: 200, y: 0 }).length >= 25);
  const l = getLevel('SB03'),
    g = geometry(l);
  const pair = l.edges.slice(0, 2);
  assert.notDeepEqual(g.curves.b1.point(0.5), g.curves.b2.point(0.5));
  assert.deepEqual(
    hits(g.curves.b1.point(0.5), g, pair).map((e) => e.id),
    ['b1'],
  );
});

test('future-version snapshots are preserved rather than silently overwritten', () => {
  let raw = JSON.stringify({ ...emptySnapshot(), version: 2 });
  const original = raw;
  const storage = storageAdapter(() => ({
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  }));
  assert.equal(storage.read().version, 1);
  assert.equal(storage.trySet(emptySnapshot()), false);
  assert.equal(raw, original);
});
