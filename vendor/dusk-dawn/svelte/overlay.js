// Android back for the package's own overlays (style.md §14): the open Select
// menu and the time picker. Each registers itself while open; the app's back
// handler calls dismissOverlay() first and stops if it closed something.

/** @type {(() => void)[]} */
const stack = [];

/**
 * Register a close function while an overlay is open. Returns a release
 * function to call when the overlay closes by any other route.
 * @param {() => void} close
 * @returns {() => void}
 */
export function pushOverlay(close) {
  stack.push(close);
  return () => {
    const i = stack.lastIndexOf(close);
    if (i !== -1) stack.splice(i, 1);
  };
}

/**
 * Close the top-most package overlay, if one is open, and say whether it did.
 * Call it first from the app's Android back handler:
 * `if (dismissOverlay()) return;`
 * @returns {boolean}
 */
export function dismissOverlay() {
  const close = stack.pop();
  if (!close) return false;
  close();
  return true;
}
