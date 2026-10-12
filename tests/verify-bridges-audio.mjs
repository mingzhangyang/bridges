import test from 'node:test';
import assert from 'node:assert/strict';
import { audioService } from '../src/audio.js';
function fakeAudio() {
  const calls = { created: 0, played: 0, resumed: 0, suspended: 0 };
  class Audio {
    constructor() {
      calls.created++;
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = {};
    }
    async resume() {
      calls.resumed++;
      this.state = 'running';
    }
    async suspend() {
      calls.suspended++;
      this.state = 'suspended';
    }
    createOscillator() {
      return {
        frequency: {},
        connect() {
          return { connect() {} };
        },
        start() {
          calls.played++;
        },
        stop() {},
      };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
  }
  return { Audio, calls };
}
test('unmuted preference can activate sound on a new walk and resume after background', async () => {
  const { Audio, calls } = fakeAudio(),
    original = globalThis.AudioContext;
  globalThis.AudioContext = Audio;
  try {
    const audio = audioService();
    assert.equal(calls.created, 0);
    assert.equal(await audio.step('wood'), true);
    audio.suspend();
    assert.equal(await audio.step('iron'), true);
    assert.equal(calls.played, 2);
    assert.equal(calls.created, 1);
    assert.equal(calls.resumed, 2);
  } finally {
    globalThis.AudioContext = original;
  }
});
test('an asynchronous audio activation cannot play after the user mutes or backgrounds', async () => {
  const { Audio, calls } = fakeAudio(),
    original = globalThis.AudioContext;
  globalThis.AudioContext = Audio;
  try {
    const audio = audioService();
    assert.equal(await audio.step('wood', () => false), false);
    assert.equal(calls.played, 0);
    assert.equal(calls.suspended, 1);
  } finally {
    globalThis.AudioContext = original;
  }
});
