import test from 'node:test';
import assert from 'node:assert/strict';
import { manifest } from '../src/content/daily-manifest.js';
import { shanghaiDate, dailyEntry, dailyKey, dailyHash } from '../src/services/daily.js';
import { getLevel, levels, commissions } from '../src/content/levels.js';
import { resolveDailyLink, resolveSavedSelection } from '../src/services/progress.js';
import { extendSchedule } from '../tools/generators/daily-schedule.mjs';
import { initialSettings } from '../src/services/settings.js';
import { emptySnapshot, storageAdapter, recordCompletion, mergeSnapshots } from '../src/storage.js';
import { newRun, move, confirmBlueprint } from '../src/model/commands.js';
import { applyEdits, repairSolution } from '../src/model/repair.js';
import { hint } from '../src/services/hints.js';
import { sweep, hits } from '../src/input/bridge-hit-test.js';
import { geometry } from '../src/render/geometry.js';
test('366 offline dates are contiguous, with walk daily and repair on weekends only', () => {
  const dates = [...new Set(manifest.map((e) => e.date))];
  assert.equal(dates.length, 366);
  for (let i = 1; i < dates.length; i++)
    assert.equal(new Date(dates[i]) - new Date(dates[i - 1]), 86400000);
  for (const entry of manifest) {
    assert.equal(getLevel(entry.walk).kind, 'walk');
    const day = new Date(entry.date).getUTCDay();
    assert.equal(!!entry.repair, [0, 6].includes(day));
    if (entry.repair) assert.equal(getLevel(entry.repair).kind, 'repair');
  }
  // Each day's revisions are 1..n with no gaps or duplicates, so older ones were never dropped.
  for (const date of dates)
    assert.deepEqual(
      manifest.filter((e) => e.date === date).map((e) => e.revision),
      Array.from({ length: manifest.filter((e) => e.date === date).length }, (_, i) => i + 1),
      date,
    );
});
const revised = [
  { date: '2026-10-12', revision: 1, walk: 'SB01', repair: null },
  { date: '2026-10-12', revision: 2, walk: 'SB08', repair: null },
];
test('a revised day keeps its published revision resolvable and offers the newest', () => {
  assert.equal(dailyEntry(new Date('2026-10-12T00:00Z'), revised).revision, 2);
  assert.equal(resolveSavedSelection('daily:2026-10-12:1:walk', revised).level.id, 'SB01');
  assert.equal(dailyHash(revised[0]), 'daily/2026-10-12/1/walk');
  const fresh = emptySnapshot();
  assert.equal(resolveDailyLink('daily/2026-10-12/1/walk', fresh, revised).level.id, 'SB01');
  assert.equal(resolveDailyLink('daily/2026-10-12/walk', fresh, revised).level.id, 'SB08');
  const started = { ...fresh, runs: { 'daily:2026-10-12:1:walk': {} } };
  assert.equal(resolveDailyLink('daily/2026-10-12/walk', started, revised).level.id, 'SB01');
  const last = { ...started, lastLevel: 'daily:2026-10-12:2:walk' };
  assert.equal(resolveDailyLink('daily/2026-10-12/walk', last, revised).level.id, 'SB08');
  for (const bad of ['daily/2026-10-12/3/walk', 'daily/2026-10-12/fly', 'daily/2030-01-01/walk'])
    assert.equal(resolveDailyLink(bad, fresh, revised), null, bad);
});
test('the schedule generator only appends and never rewrites published entries', () => {
  const options = { walks: levels.filter((l) => l.kind === 'walk'), commissions };
  assert.deepEqual(extendSchedule(manifest, options), manifest);
  const withRevision = [...manifest, { ...manifest[3], revision: 2, walk: 'SB02' }];
  const extended = extendSchedule(withRevision, options);
  assert.equal(extended.length, manifest.length + 1);
  assert.deepEqual(
    extended.filter((e) => e.date === manifest[3].date),
    [manifest[3], { ...manifest[3], revision: 2, walk: 'SB02' }],
  );
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
test('malformed saves remain recoverable and can be replaced by a valid snapshot', () => {
  const malformed = [
    'null',
    '{}',
    '{"version":0}',
    '{"version":"2"}',
    '{"version":1}',
    JSON.stringify({ ...emptySnapshot(), runs: [] }),
  ];
  for (const original of malformed) {
    let raw = original;
    const adapter = storageAdapter(() => ({
      getItem: () => raw,
      setItem: (_, content) => {
        raw = content;
      },
    }));
    assert.deepEqual(adapter.read(), emptySnapshot(), original);
    assert.equal(adapter.failed, true, original);
    const recovered = { ...emptySnapshot(), lastLevel: 'SB03' };
    assert.equal(adapter.trySet(recovered), true, original);
    assert.equal(adapter.failed, false, original);
    assert.deepEqual(adapter.read(), recovered, original);
    assert.equal(raw, JSON.stringify(recovered), original);
  }
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
test('the latest distinct route replaces an equal-cost witness; cheaper works are kept', () => {
  const l = getLevel('SB01');
  const walk = (ids, runId = 'run') => {
    let r = { ...newRun(l), runId };
    for (const id of ids) r = move(l, r, id).run;
    return r;
  };
  let s = recordCompletion(emptySnapshot(), l.id, l, walk(['b1', 'b2', 'b3']));
  // Same run after a replay rewind, finished along a different route.
  s = recordCompletion(s, l.id, l, walk(['b3', 'b2', 'b1']));
  assert.deepEqual(s.completions.SB01.independent.edges, ['b3', 'b2', 'b1']);
  assert.equal(recordCompletion(s, l.id, l, walk(['b3', 'b2', 'b1'], 'reloaded')), s);
  const works = getLevel('SB25'),
    { ids, route } = repairSolution(works);
  let plan = confirmBlueprint(works, { ...newRun(works), draftEdits: ids });
  for (const id of route.edges) plan = move(applyEdits(works, ids).graph, plan, id).run;
  const cheap = recordCompletion(emptySnapshot(), works.id, works, plan, 1);
  assert.equal(recordCompletion(cheap, works.id, works, { ...plan, runId: 'x' }, 2), cheap);
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
  for (const future of [{ ...emptySnapshot(), version: 2 }, { version: 1.5 }, { version: 99 }]) {
    let raw = JSON.stringify(future);
    const original = raw;
    const storage = storageAdapter(() => ({
      getItem: () => raw,
      setItem: (_, value) => {
        raw = value;
      },
    }));
    assert.equal(storage.read().version, 1);
    assert.equal(storage.failed, true);
    assert.equal(storage.trySet(emptySnapshot()), false);
    assert.equal(raw, original);
  }
});

test('invalid lastLevel recovers the navigation field without discarding valid records', () => {
  const saved = { ...emptySnapshot(), lastLevel: 1 };
  const adapter = storageAdapter(() => ({ getItem: () => JSON.stringify(saved) }));
  assert.equal(adapter.read().lastLevel, 'SB01');
});

test('a wrong free start is answered with a way back to choose again', () => {
  const l = getLevel('SB04'),
    r = move(l, { ...newRun(l), startNode: 'B', currentNode: 'B', history: ['B'] }, 'b1').run;
  const h = hint(l, r, 3);
  assert.equal(h.kind, 'start');
  assert.equal(h.steps, 1);
  assert.equal(h.index, 0);
});
test('discovery witnesses compare islands as a set', () => {
  const l = getLevel('SB24'),
    base = { ...newRun(l), phase: 'complete', explained: true };
  const s = recordCompletion(emptySnapshot(), l.id, l, {
    ...base,
    discoveryNodes: ['A', 'B', 'C', 'D'],
  });
  assert.equal(
    recordCompletion(s, l.id, l, { ...base, runId: 'again', discoveryNodes: ['D', 'C', 'B', 'A'] }),
    s,
  );
});
test('merging another tab keeps both tabs records and this tab open run', () => {
  const ours = {
      ...emptySnapshot(),
      completions: { SB01: { independent: { runId: 'a' } } },
      runs: { SB02: { runId: 'mine' }, SB03: { runId: 'old' } },
    },
    theirs = {
      ...emptySnapshot(),
      completions: { SB05: { assisted: { runId: 'b' } }, SB01: { assisted: { runId: 'c' } } },
      runs: { SB02: { runId: 'stale' }, SB03: { runId: 'new' } },
      assistance: { 'daily:2026-10-12:1:walk': true },
    };
  const merged = mergeSnapshots(ours, theirs, 'SB02');
  assert.deepEqual(Object.keys(merged.completions.SB01).sort(), ['assisted', 'independent']);
  assert.ok(merged.completions.SB05.assisted);
  assert.equal(merged.runs.SB02.runId, 'mine');
  assert.equal(merged.runs.SB03.runId, 'new');
  assert.equal(merged.assistance['daily:2026-10-12:1:walk'], true);
});
test('runs start without crypto.randomUUID (plain http on a LAN address)', () => {
  const original = globalThis.crypto.randomUUID;
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const id = newRun(getLevel('SB01')).runId;
    assert.match(id, /^[0-9a-f]{32}$/);
  } finally {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: original, configurable: true });
  }
});
