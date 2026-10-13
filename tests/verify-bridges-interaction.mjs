import test from 'node:test';
import assert from 'node:assert/strict';
import { allLevels, getLevel } from '../src/content/levels.js';
import { newRun, move, chooseStart, confirmBlueprint, graphFor } from '../src/model/commands.js';
import { eulerRoute } from '../src/model/euler.js';
import { repairSolution } from '../src/model/repair.js';
import {
  actionableBridges,
  bridgeAction,
  bridgeState,
  nodeAction,
  visibleEdges,
} from '../src/model/interaction.js';
import { bridgeLabel, nodeLabel } from '../src/render/labels.js';
import { citySVG } from '../src/render/city.js';
import { geometry } from '../src/render/geometry.js';
import { motionController } from '../src/render/motion.js';
import { nextBridge } from '../src/input/keyboard.js';

// Walk every playable level along its proven route. At every step, a bridge is offered as
// walkable exactly when move() accepts it, and islands are offered exactly when chooseStart
// would change the run.
test('interaction model agrees with the commands on every level and step', () => {
  for (const l of allLevels.filter((l) => l.kind !== 'discovery')) {
    let run = newRun(l),
      route;
    if (l.kind === 'repair') {
      const proof = repairSolution(l);
      run = confirmBlueprint(l, { ...run, draftEdits: proof.ids });
      route = proof.route;
    } else
      route = eulerRoute(l, l.fixedStart, l.objective === 'return' ? l.fixedStart : l.fixedEnd);
    const check = () => {
      const g = graphFor(l, run);
      for (const node of l.nodes) {
        const chosen = chooseStart(l, run, node.id);
        if (nodeAction(l, run, node.id) === 'start')
          assert.equal(chosen.startNode, node.id, `${l.id} ${node.id}`);
        else
          assert.deepEqual(
            [chosen.startNode, chosen.currentNode],
            [run.startNode, run.currentNode],
            `${l.id} ${node.id} is inert yet changes the start`,
          );
      }
      for (const e of g.edges)
        assert.equal(
          bridgeAction(l, g, run, e.id) === 'walk',
          !move(g, run, e.id).error,
          `${l.id} ${e.id} at ${run.currentNode}`,
        );
    };
    check();
    if (!run.currentNode) run = chooseStart(l, run, route.start);
    for (const id of route.edges) {
      check();
      run = move(graphFor(l, run), run, id).run;
    }
    assert.equal(run.phase, 'complete', l.id);
    check();
    assert.deepEqual(actionableBridges(l, graphFor(l, run), run), [], l.id);
  }
});

test('planning offers only editable candidates and explains the rest', () => {
  const l = getLevel('SB31'),
    run = newRun(l),
    g = graphFor(l, run);
  for (const e of visibleEdges(l, g, run)) {
    const action = bridgeAction(l, g, run, e.id),
      state = bridgeState(l, g, run, e.id);
    if (l.protectedEdges.includes(e.id)) assert.equal(state, 'protected');
    assert.equal(action === 'edit', ['canAdd', 'canRemove'].includes(state), e.id);
  }
  // Add-only commissions have no protected bridges: existing bridges are simply not candidates.
  const sb26 = getLevel('SB26'),
    plan = newRun(sb26),
    pg = graphFor(sb26, plan);
  for (const e of sb26.edges) {
    assert.equal(bridgeAction(sb26, pg, plan, e.id), null);
    assert.equal(bridgeState(sb26, pg, plan, e.id), 'fixed');
  }
  assert.equal(nodeAction(sb26, plan, sb26.nodes[0].id), null, 'islands are inert while planning');
});

test('discovery islands toggle while bridges stay inert', () => {
  const l = getLevel('SB24'),
    run = { ...newRun(l), phase: 'discovery' };
  assert.deepEqual(actionableBridges(l, l, run), []);
  for (const n of l.nodes) assert.equal(nodeAction(l, run, n.id), 'toggle');
  assert.equal(nodeAction(l, { ...run, phase: 'complete' }, 'A'), null);
});

test('accessible names use island letters and names with the bridge state', () => {
  const l = getLevel('SB01'),
    run = newRun(l);
  const label = (id, r = run, lang = 'en') =>
    bridgeLabel(
      l,
      l,
      r,
      l.edges.find((e) => e.id === id),
      lang,
    );
  assert.equal(label('b1'), 'Bridge b1 to B · North quay, available');
  assert.equal(label('b2'), 'Bridge b2: B · North quay ↔ C · South quay, not used');
  assert.equal(label('b1', run, 'zh'), '桥 b1，通往 B · 北岸，可通行');
  const after = move(l, run, 'b1').run;
  assert.equal(label('b1', after), 'Bridge b1: A · Lighthouse ↔ B · North quay, used');
  assert.equal(nodeLabel(l, after, 'B', 'en'), 'B · North quay, messenger is here');
});

test('rendered scene exposes exactly the actionable elements as tab stops', () => {
  const l = getLevel('SB01'),
    run = newRun(l),
    geo = geometry(l, false);
  const svg = citySVG(l, l, run, geo, { lang: 'en' });
  const stops = [...svg.matchAll(/data-(bridge|node)="([^"]+)"[^>]*tabindex="0"/g)].map(
    (m) => m[2],
  );
  assert.deepEqual(stops, actionableBridges(l, l, run));
  assert.doesNotMatch(svg, /data-node="[^"]+" role="button"/);
  const preview = citySVG(l, l, run, geo, { lang: 'en', interactive: false });
  assert.doesNotMatch(preview, /data-(bridge|node)=/);
  assert.doesNotMatch(preview, /tabindex|role="button"/);
});

test('cancelling a walk places the messenger at the committed destination', () => {
  const raf = globalThis.requestAnimationFrame,
    caf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  let transform = '';
  const element = { setAttribute: (_, value) => (transform = value) },
    curve = { b: { x: 100, y: 0 }, point: (t) => ({ x: 100 * t, y: 0 }) };
  try {
    const motion = motionController(
      () => {},
      () => false,
    );
    motion.walk(element, curve, { x: 0, y: 0 }, { x: 100, y: 0 });
    assert.equal(motion.busy, true);
    motion.cancel();
    assert.equal(transform, 'translate(100,0)');
    assert.equal(motion.busy, false);
  } finally {
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;
  }
});

test('arrow navigation starts from either end when focus is off the actionable list', () => {
  const ids = ['x', 'y', 'z'];
  assert.equal(nextBridge(ids, 'used', true), 'z');
  assert.equal(nextBridge(ids, 'used', false), 'x');
  assert.equal(nextBridge(ids, undefined, true), 'z');
  assert.equal(nextBridge(ids, 'x', true), 'z');
  assert.equal(nextBridge(ids, 'z', false), 'x');
  assert.equal(nextBridge(ids, 'y', true), 'x');
  assert.equal(nextBridge([], 'x', true), null);
});
