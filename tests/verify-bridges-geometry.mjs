import test from 'node:test';
import assert from 'node:assert/strict';
import { allLevels } from '../src/content/levels.js';
import { geometry } from '../src/render/geometry.js';
import { beginTrace, advanceTrace } from '../src/input/bridge-trace.js';
import { ferryBerth, FERRY_BOX, NAME_STEPS, nameSize, placeNames } from '../src/render/city.js';
import { propSpots, TRAVELER_SILHOUETTE } from '../src/render/scenery.js';

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
test('Island names stay clear of bridges, islands, landmarks, names and count badges', () => {
  for (const level of allLevels)
    for (const portrait of [false, true])
      for (const lang of ['zh', 'en'])
        for (const counts of [false, true]) {
          const geo = geometry(level, portrait),
            names = placeNames(level, geo, lang, counts),
            where = `${level.id} ${portrait ? 'portrait' : 'landscape'} ${lang}${counts ? ' counts' : ''}`,
            overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1,
            // Test the same translated prop extents independently of the name algorithm.
            landmarks = level.nodes.flatMap((node, i) => {
              const { x, y } = geo.nodes[node.id];
              return propSpots(node.id, i, geo).map(({ box }) => ({
                id: node.id,
                box: {
                  x0: x + box.x0 - 2,
                  x1: x + box.x1 + 2,
                  y0: y + box.y0 - 2,
                  y1: y + box.y1 + 2,
                },
              }));
            }),
            entries = Object.entries(names);
          for (const [i, [id, { box }]] of entries.entries()) {
            for (const [other, name] of entries.slice(i + 1))
              assert.ok(!overlaps(box, name.box), `${where}: ${id} overlaps ${other}`);
            for (const landmark of landmarks)
              assert.ok(
                !overlaps(box, landmark.box),
                `${where}: ${id} obscures landmark on ${landmark.id}`,
              );
            for (const node of level.nodes) {
              const q = geo.nodes[node.id];
              // Every other island's terrain top (72 × 47) stays clear of the name.
              if (node.id !== id) {
                const cx = Math.max(box.x0, Math.min(q.x, box.x1)),
                  cy = Math.max(box.y0, Math.min(q.y, box.y1));
                assert.ok(
                  ((cx - q.x) / 72) ** 2 + ((cy - q.y) / 47) ** 2 >= 1,
                  `${where}: ${id} on ${node.id}`,
                );
              }
              if (counts)
                assert.ok(
                  !overlaps(box, { x0: q.x - 28, x1: q.x + 28, y0: q.y - 80, y1: q.y - 51 }),
                  `${where}: ${id} covers the count badge of ${node.id}`,
                );
            }
          }
          // Measured against each densely sampled centreline, independently of the placement
          // scorer: every name box stays outside the 14 px deck (7 px either side).
          for (const [id, { box }] of Object.entries(names))
            for (const curve of Object.values(geo.curves))
              for (let i = 0; i <= 512; i++) {
                const p = curve.point(i / 512),
                  gap = Math.hypot(
                    Math.max(box.x0 - p.x, 0, p.x - box.x1),
                    Math.max(box.y0 - p.y, 0, p.y - box.y1),
                  );
                assert.ok(gap >= 7, `${where}: ${id} on a bridge deck`);
              }
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
test('A level keeps one name placement per layout, language and badge setting', () => {
  const level = allLevels.find((l) => l.id === 'SB20');
  for (const portrait of [false, true]) {
    const geo = geometry(level, portrait);
    assert.equal(
      placeNames(level, geo, 'en', false),
      placeNames(level, geometry(level, portrait), 'en', false),
    );
    assert.notEqual(placeNames(level, geo, 'en', false), placeNames(level, geo, 'zh', false));
    assert.notEqual(placeNames(level, geo, 'en', false), placeNames(level, geo, 'en', true));
  }
});
test('Every island keeps its landmark standing clear of its own streets', () => {
  for (const level of allLevels)
    for (const portrait of [false, true]) {
      const geo = geometry(level, portrait);
      for (const [i, node] of level.nodes.entries()) {
        const o = geo.nodes[node.id],
          spots = propSpots(node.id, i, geo),
          where = `${level.id} ${portrait ? 'portrait' : 'landscape'} ${node.id}`;
        assert.deepEqual(
          spots.map((s) => s.role),
          ['landmark'],
          where,
        );
        for (const spot of spots) {
          assert.ok(spot.scale >= 0.85, `${where}: ${spot.role} too small`);
          for (const body of TRAVELER_SILHOUETTE)
            assert.ok(
              spot.box.x1 + 2 <= body.x0 ||
                body.x1 + 2 <= spot.box.x0 ||
                spot.box.y1 + 2 <= body.y0 ||
                body.y1 + 2 <= spot.box.y0,
              `${where}: ${spot.role} overlaps the messenger silhouette`,
            );
        }
        for (const curve of Object.values(geo.curves)) {
          const end = curve.canonical.indexOf(node.id);
          if (end < 0) continue;
          // Densely, from the square's edge out to this island's quay; under the square is hidden.
          const quay = curve.ends[end].t;
          for (let k = 0; k <= 200; k++) {
            const p = curve.point(end ? 1 - ((1 - quay) * k) / 200 : (quay * k) / 200),
              x = p.x - o.x,
              y = p.y - o.y;
            if (Math.hypot(x, y) <= 22) continue;
            for (const { role, base } of spots) {
              const gap = Math.hypot(
                Math.max(base.x0 - x, 0, x - base.x1),
                Math.max(base.y0 - y, 0, y - base.y1),
              );
              assert.ok(gap >= 4.5, `${where}: the ${role} stands on a street`);
            }
          }
        }
      }
    }
});
test('The waiting ferry berths on open water in every level that lets the player choose a start', () => {
  for (const level of allLevels.filter((l) => !l.fixedStart))
    for (const portrait of [false, true]) {
      const geo = geometry(level, portrait),
        { x, y } = ferryBerth(level, geo),
        box = {
          x0: x + FERRY_BOX.x0,
          x1: x + FERRY_BOX.x1,
          y0: y + FERRY_BOX.y0,
          y1: y + FERRY_BOX.y1,
        },
        where = `${level.id} ${portrait ? 'portrait' : 'landscape'}`,
        gap = (p) =>
          Math.hypot(
            Math.max(box.x0 - p.x, 0, p.x - box.x1),
            Math.max(box.y0 - p.y, 0, p.y - box.y1),
          );
      assert.ok(
        box.x0 >= 0 && box.x1 <= geo.w && box.y0 >= 0 && box.y1 <= geo.h,
        `${where}: off the map`,
      );
      for (const node of level.nodes) {
        const q = geo.nodes[node.id],
          cx = Math.max(box.x0, Math.min(q.x, box.x1)),
          cy = Math.max(box.y0, Math.min(q.y, box.y1));
        // Terrain with its shadow, and the landmark rising north of the square.
        assert.ok(((cx - q.x) / 82) ** 2 + ((cy - q.y) / 60) ** 2 >= 1, `${where}: on ${node.id}`);
        assert.ok(gap({ x: q.x, y: q.y - 60 }) >= 20, `${where}: on the landmark of ${node.id}`);
        assert.ok(
          box.x1 <= q.x - 28 || box.x0 >= q.x + 28 || box.y1 <= q.y - 80 || box.y0 >= q.y - 51,
          `${where}: on the count badge of ${node.id}`,
        );
      }
      for (const curve of Object.values(geo.curves))
        for (let i = 0; i <= 512; i++)
          assert.ok(gap(curve.point(i / 512)) >= 10, `${where}: on a bridge deck`);
      for (const lang of ['zh', 'en'])
        for (const counts of [false, true])
          for (const [id, name] of Object.entries(placeNames(level, geo, lang, counts)))
            assert.ok(
              name.box.x1 <= box.x0 ||
                name.box.x0 >= box.x1 ||
                name.box.y1 <= box.y0 ||
                name.box.y0 >= box.y1,
              `${where} ${lang}: on the name of ${id}`,
            );
    }
});
test('A name keeps its full size unless its corner is crowded, and never shrinks past 70%', () => {
  let stepped = 0,
    total = 0;
  for (const level of allLevels)
    for (const portrait of [false, true]) {
      const geo = geometry(level, portrait);
      for (const lang of ['zh', 'en'])
        for (const counts of [false, true])
          for (const [id, name] of Object.entries(placeNames(level, geo, lang, counts))) {
            assert.ok(
              NAME_STEPS.some((k) => Math.abs(name.size - nameSize(geo) * k) < 1e-9),
              `${level.id} ${id}`,
            );
            total++;
            if (name.size < nameSize(geo)) stepped++;
          }
    }
  // Today 38 of 1856; a regression in placement shows up as many more.
  assert.ok(stepped / total < 0.03, `${stepped} of ${total} names stepped down`);
});
