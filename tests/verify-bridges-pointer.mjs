import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPointer } from '../src/input/pointer.js';

function pointerHarness(t, ambiguous = false, { replaceRun = false, cancelOnSubmit = false } = {}) {
  const original = globalThis.DOMPoint;
  globalThis.DOMPoint = class {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    matrixTransform() {
      return this;
    }
  };
  t.after(() => {
    globalThis.DOMPoint = original;
  });
  const point = (t) => ({ x: 100 + 400 * t, y: 100 + 800 * t * (1 - t) });
  const edges = [{ id: 'ab1', u: 'A', v: 'B' }];
  if (ambiguous) edges.push({ id: 'ab2', u: 'A', v: 'B' });
  const curve = { samples: Array.from({ length: 65 }, (_, i) => point(i / 64)) };
  const geo = {
    w: 600,
    h: 500,
    nodes: { A: point(0), B: point(1) },
    curves: Object.fromEntries(edges.map((edge) => [edge.id, curve])),
  };
  const handlers = {},
    submitted = [],
    choices = [];
  let run = { currentNode: 'A' },
    locked = false;
  const stage = {
    addEventListener: (name, handler) => {
      handlers[name] = handler;
    },
    querySelector: () => ({ getScreenCTM: () => ({ inverse() {} }) }),
    setPointerCapture() {},
    releasePointerCapture() {},
  };
  const cancel = attachPointer(
    stage,
    () => ({
      geo,
      graph: { edges },
      run,
      locked,
      walkable: (id) => {
        const edge = edges.find((edge) => edge.id === id);
        return !submitted.includes(id) && [edge.u, edge.v].includes(run.currentNode);
      },
    }),
    (id) => {
      const edge = edges.find((edge) => edge.id === id);
      const currentNode = edge.u === run.currentNode ? edge.v : edge.u;
      submitted.push(id);
      if (replaceRun) run = { ...run, currentNode };
      else run.currentNode = currentNode;
      if (cancelOnSubmit) cancel();
    },
    () => assert.fail('A drag must not select a start island'),
    (edges) => choices.push(edges.map((edge) => edge.id)),
  );
  const send = (type, p) =>
    handlers[type]({
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: p.x,
      clientY: p.y,
      target: { closest: () => ({ dataset: { node: 'A' } }) },
    });
  const moveTo = (steps) => {
    send('pointerdown', point(0));
    for (let i = 1; i <= steps; i++) send('pointermove', point(i / 20));
  };
  return {
    send,
    point,
    moveTo,
    submitted,
    choices,
    geo,
    edges,
    setLocked: (value) => {
      locked = value;
    },
  };
}

for (const ambiguous of [false, true]) {
  const label = ambiguous ? 'overlapping bridges' : 'a unique bridge';
  test(`Releasing across a curved corridor cannot complete or choose ${label}`, (t) => {
    const h = pointerHarness(t, ambiguous);
    h.moveTo(5);
    h.send('pointerup', h.point(1));
    assert.deepEqual(h.submitted, []);
    assert.deepEqual(h.choices, []);
  });
  test(`A valid final release segment completes or chooses ${label}`, (t) => {
    const h = pointerHarness(t, ambiguous);
    h.moveTo(19);
    assert.deepEqual(h.submitted, []);
    assert.deepEqual(h.choices, []);
    h.send('pointerup', h.point(1));
    assert.deepEqual(h.submitted, ambiguous ? [] : ['ab1']);
    assert.deepEqual(h.choices, ambiguous ? [['ab1', 'ab2']] : []);
  });
}

test('Releasing after the last move already completed a bridge does not submit twice', (t) => {
  const h = pointerHarness(t);
  h.moveTo(20);
  assert.deepEqual(h.submitted, ['ab1']);
  h.send('pointerup', h.point(1));
  assert.deepEqual(h.submitted, ['ab1']);
  assert.deepEqual(h.choices, []);
});

for (const replaceRun of [false, true]) {
  test(`A held drag resumes at the destination after submit ${replaceRun ? 'replaces' : 'mutates'} the run`, (t) => {
    const h = pointerHarness(t, false, { replaceRun });
    h.geo.nodes.C = { x: 100, y: 450 };
    // Store the second edge in reverse order to exercise both endpoint directions.
    h.edges.push({ id: 'cb', u: 'C', v: 'B' });
    const next = (t) => ({ x: 500 - 400 * t, y: 100 + 350 * t });
    h.geo.curves.cb = { samples: Array.from({ length: 65 }, (_, i) => next(i / 64)) };
    h.moveTo(20);
    assert.deepEqual(h.submitted, ['ab1']);
    h.setLocked(true);
    h.send('pointermove', next(0.05));
    assert.deepEqual(h.submitted, ['ab1']);
    h.setLocked(false);
    for (let i = 1; i <= 20; i++) h.send('pointermove', next(i / 20));
    h.send('pointerup', next(1));
    assert.deepEqual(h.submitted, ['ab1', 'cb']);
    assert.deepEqual(h.choices, []);
  });
}

test('A submit callback can cancel a held gesture without reviving it or throwing', (t) => {
  const h = pointerHarness(t, false, { cancelOnSubmit: true });
  h.moveTo(20);
  h.send('pointermove', h.point(0.5));
  h.send('pointerup', h.point(1));
  assert.deepEqual(h.submitted, ['ab1']);
  assert.deepEqual(h.choices, []);
});
