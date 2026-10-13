// Arrow keys cycle through the bridges that can be acted on. Focus often rests on a bridge
// that just left that list (it was crossed), so a missing current starts from either end.
export function nextBridge(ids, current, backward) {
  if (!ids.length) return null;
  const index = ids.indexOf(current);
  if (index < 0) return backward ? ids.at(-1) : ids[0];
  return ids[(index + (backward ? ids.length - 1 : 1)) % ids.length];
}
export function attachKeyboard(stage, submit, selectNode, available) {
  stage.addEventListener('keydown', (e) => {
    if (['Enter', ' '].includes(e.key)) {
      const bridge = e.target.closest('[data-bridge]')?.dataset.bridge,
        node = e.target.closest('[data-node]')?.dataset.node;
      if (bridge || node) {
        e.preventDefault();
        if (bridge) submit(bridge);
        else selectNode(node);
      }
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const next = nextBridge(
        available(),
        e.target.closest('[data-bridge]')?.dataset.bridge,
        ['ArrowLeft', 'ArrowUp'].includes(e.key),
      );
      if (!next) return;
      e.preventDefault();
      stage.querySelector(`[data-bridge="${next}"]`)?.focus();
    }
  });
}
