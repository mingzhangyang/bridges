import test from 'node:test';
import assert from 'node:assert/strict';
import { motionController } from '../src/render/motion.js';
test('cancelling a morph owns cleanup of the stage lock across every caller', () => {
  const original = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = () => {};
  const classes = new Set(),
    stage = {
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
      querySelector: () => ({ classList: { toggle() {} } }),
    };
  try {
    const motion = motionController(
      () => {},
      () => false,
    );
    motion.morph(stage, 'graph');
    assert.equal(classes.has('morphing'), true);
    assert.equal(motion.busy, true);
    motion.cancel();
    assert.equal(classes.has('morphing'), false);
    assert.equal(motion.busy, false);
  } finally {
    globalThis.cancelAnimationFrame = original;
  }
});
