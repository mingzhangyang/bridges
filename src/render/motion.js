export function motionController(
  onEnd,
  reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches,
) {
  let frame = 0,
    timer = 0,
    token = 0,
    moving = false,
    buffer = null,
    morphStage = null;
  const finish = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    morphStage?.classList.remove('morphing');
    morphStage = null;
    moving = false;
  };
  return {
    get busy() {
      return moving;
    },
    enqueue(id) {
      buffer = id;
    },
    cancel() {
      token++;
      buffer = null;
      finish();
    },
    morph(stage, view) {
      this.cancel();
      morphStage = stage;
      stage.classList.add('morphing');
      moving = true;
      const mine = ++token;
      timer = setTimeout(
        () => {
          if (mine !== token) return;
          finish();
          onEnd(null);
        },
        reduced() ? 0 : 460,
      );
      stage.querySelector('svg')?.classList.toggle('graph-view', view === 'graph');
    },
    walk(element, curve, from, to) {
      this.cancel();
      if (reduced()) {
        element?.setAttribute('transform', `translate(${to.x},${to.y})`);
        onEnd(null);
        return;
      }
      moving = true;
      const mine = ++token,
        start = performance.now(),
        reverse = Math.hypot(from.x - curve.b.x, from.y - curve.b.y) < 1;
      const tick = (now) => {
        if (mine !== token) return;
        const t = Math.min(1, (now - start) / 330),
          p = curve.point(reverse ? 1 - t : t);
        element?.setAttribute('transform', `translate(${p.x},${p.y})`);
        if (t < 1) frame = requestAnimationFrame(tick);
        else {
          const next = buffer;
          buffer = null;
          finish();
          onEnd(next);
        }
      };
      frame = requestAnimationFrame(tick);
    },
  };
}
