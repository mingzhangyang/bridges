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
      const ids = available(),
        current = e.target.closest('[data-bridge]')?.dataset.bridge;
      if (!ids.length) return;
      e.preventDefault();
      const index = ids.indexOf(current),
        next =
          ids[
            (index + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? ids.length - 1 : 1)) % ids.length
          ];
      stage.querySelector(`[data-bridge="${next}"]`)?.focus();
    }
  });
}
