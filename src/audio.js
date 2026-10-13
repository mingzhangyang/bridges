export function audioService() {
  let context = null,
    epoch = 0;
  const voices = new Set();
  function tone(frequency, duration, volume, delay = 0, type = 'sine') {
    const source = context.createOscillator(),
      gain = context.createGain();
    source.type = type;
    source.frequency.value = frequency;
    const at = context.currentTime + delay;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    source.connect(gain).connect(context.destination);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect?.();
      gain.disconnect?.();
    };
    source.start(at);
    source.stop(at + duration);
  }
  function water() {
    // One short, filtered shoreline wash; never a continuously running sound loop.
    if (!context.createBuffer) return;
    const duration = 0.45,
      buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * duration),
        context.sampleRate,
      );
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++)
      samples[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / samples.length);
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 550;
    gain.gain.value = 0.016;
    source.connect(filter).connect(gain).connect(context.destination);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start();
    source.stop(context.currentTime + duration);
  }
  return {
    async enable() {
      const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Audio) return false;
      try {
        context ??= new Audio();
        await context.resume();
        return context.state === 'running';
      } catch {
        return false;
      }
    },
    async step(material = 'wood', active = () => true, completed = false) {
      const generation = epoch;
      if (!(await this.enable()) || generation !== epoch) return false;
      if (!active()) {
        this.suspend();
        return false;
      }
      const frequency = { wood: 240, stone: 265, iron: 290 }[material] ?? 240;
      tone(frequency, 0.12, 0.024, 0, material === 'wood' ? 'triangle' : 'sine');
      tone(frequency * 0.94, 0.12, 0.018, 0.14);
      water();
      if (completed) {
        tone(660, 0.75, 0.018, 0.3);
        tone(990, 0.6, 0.008, 0.3);
      }
      return true;
    },
    suspend() {
      epoch++;
      // Stop scheduled sounds before suspension: foregrounding never replays old footsteps.
      for (const voice of voices) {
        try {
          voice.stop();
        } catch {
          /* Already ended. */
        }
      }
      voices.clear();
      context?.suspend().catch(() => {});
    },
  };
}
