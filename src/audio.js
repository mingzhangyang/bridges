export function audioService() {
  let context = null;
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
    step(material = 'wood') {
      if (context?.state !== 'running') return;
      const o = context.createOscillator(),
        g = context.createGain();
      o.type = 'sine';
      o.frequency.value = { wood: 240, stone: 330, iron: 420 }[material] ?? 240;
      g.gain.setValueAtTime(0.04, context.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14);
      o.connect(g).connect(context.destination);
      o.start();
      o.stop(context.currentTime + 0.15);
    },
    suspend() {
      context?.suspend().catch(() => {});
    },
  };
}
