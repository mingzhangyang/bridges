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
test('Completion animations are finite, cancellable and absent with reduced motion', () => {
  const original = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = () => {};
  const animations = [];
  const stage = {
    querySelector: () => ({
      animate: (frames, options) => {
        const animation = {
          frames,
          options,
          cancelled: false,
          cancel() {
            this.cancelled = true;
          },
        };
        animations.push(animation);
        return animation;
      },
    }),
  };
  try {
    const reduced = motionController(
      () => {},
      () => true,
    );
    reduced.celebrate(stage);
    assert.equal(animations.length, 0);
    const motion = motionController(
      () => {},
      () => false,
    );
    motion.celebrate(stage);
    assert.equal(animations.length, 2);
    assert.ok(animations.every((a) => a.options.duration <= 1500));
    motion.cancel();
    assert.ok(animations.every((a) => a.cancelled));
    assert.equal(motion.busy, false);
  } finally {
    globalThis.cancelAnimationFrame = original;
  }
});
