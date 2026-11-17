/** Register a close function while an overlay is open; returns its release. */
export function pushOverlay(close: () => void): () => void;
/** Close the top-most package overlay (Select menu, time picker); true if one closed. */
export function dismissOverlay(): boolean;
