import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPointer } from '../src/input/pointer.js';

function pointerHarness(t, ambiguous = false) {
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
  const run = { currentNode: 'A' };
  const stage = {
    addEventListener: (name, handler) => {
      handlers[name] = handler;
    },
    querySelector: () => ({ getScreenCTM: () => ({ inverse() {} }) }),
    setPointerCapture() {},
    releasePointerCapture() {},
  };
  attachPointer(
    stage,
    () => ({ geo, graph: { edges }, run, locked: false, walkable: () => true }),
    (id) => {
      submitted.push(id);
      run.currentNode = 'B';
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
  return { send, point, moveTo, submitted, choices };
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
