export function motionController(
  onEnd,
  reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches,
) {
  let frame = 0,
    timer = 0,
    token = 0,
    moving = false,
    buffer = null,
    morphStage = null,
    walking = null;
  const celebrations = new Set();
  const place = (element, p) => element?.setAttribute('transform', `translate(${p.x},${p.y})`);
  const finish = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    morphStage?.classList.remove('morphing');
    morphStage = null;
    walking = null;
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
      for (const animation of celebrations) animation.cancel();
      celebrations.clear();
      // The move is already committed; never leave the messenger drawn mid-bridge.
      if (walking) place(walking.element, walking.to);
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
    celebrate(stage) {
      if (reduced()) return;
      for (const [selector, frames] of [
        ['.city-world', [{ transform: 'scale(1)' }, { transform: 'scale(.97)' }]],
        ['.reflections', [{ opacity: 0 }, { opacity: 0.24 }]],
      ]) {
        const animation = stage
          .querySelector(selector)
          ?.animate(frames, { duration: 1000, easing: 'ease-out' });
        if (animation) {
          celebrations.add(animation);
          animation.onfinish = () => celebrations.delete(animation);
        }
      }
    },
    walk(element, curve, from, to) {
      this.cancel();
      if (reduced()) {
        place(element, to);
        onEnd(null);
        return;
      }
      moving = true;
      walking = { element, to };
      const mine = ++token,
        start = performance.now(),
        reverse = Math.hypot(from.x - curve.b.x, from.y - curve.b.y) < 1;
      const tick = (now) => {
        if (mine !== token) return;
        const t = Math.min(1, (now - start) / 330),
          p = curve.point(reverse ? 1 - t : t);
        place(element, p);
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
