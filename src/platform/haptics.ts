// A light tap under the finger when a dragged chapter lands, or a long press
// starts selecting, where the browser can vibrate. Silent elsewhere.

export function tap(): void {
  navigator.vibrate?.(8);
}

export function select(): void {
  navigator.vibrate?.(4);
}
