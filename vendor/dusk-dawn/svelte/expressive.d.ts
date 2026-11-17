// Types for expressive.js (style.md §6.4, §11.3).
import type { Action } from 'svelte/action';

export type ShapeName =
  | 'circle'
  | 'cookie-4'
  | 'cookie-6'
  | 'cookie-7'
  | 'cookie-9'
  | 'cookie-12'
  | 'sunny'
  | 'very-sunny'
  | 'clover-4'
  | 'clover-8'
  | 'flower'
  | 'soft-burst'
  | 'puffy'
  | 'triangle'
  | 'square'
  | 'pentagon'
  | 'diamond'
  | 'gem'
  | 'heart';

export type Flourish = 'pop' | 'wiggle' | 'jelly' | 'tada' | 'spin-once' | 'flip' | 'heartbeat';

export type SpringName =
  | 'spatial-fast'
  | 'spatial-default'
  | 'spatial-slow'
  | 'spatial-calm'
  | 'effects-fast'
  | 'effects-default'
  | 'effects-slow';

/** Every Expressive shape name. */
export declare const SHAPES: readonly ShapeName[];
/** The loading indicator's morph sequence. */
export declare const LOADING_SHAPES: readonly ShapeName[];

/** True when the system asks for reduced motion. */
export declare function prefersReducedMotion(): boolean;
/** A shape as polygon points, in percent of its box. */
export declare function shapePoints(name: ShapeName, points?: number, rotate?: number): Array<[number, number]>;
/** A CSS clip-path polygon for a shape; equal `points` morph into each other. */
export declare function shapeClipPath(name: ShapeName, points?: number, rotate?: number): string;
/** A spring's CSS easing and duration in ms, read from the theme. */
export declare function spring(name: SpringName): { easing: string; duration: number };
/** Play a one-shot flourish on an element. No-op under reduced motion. */
export declare function play(node: Element | null | undefined, name: Flourish): void;

export interface CelebrateOptions {
  /** Where the burst starts: an element, or a point in viewport px. Default: upper centre. */
  origin?: Element | { x: number; y: number };
  /** Pieces of confetti (default 60). */
  count?: number;
  /** Colour token names, e.g. ['--accent-bright', '--accent-sage']. */
  colours?: string[];
  /** Expressive shapes for the pieces. */
  shapes?: ShapeName[];
  /** Text pieces mixed in: ornaments, letters, numerals. Never emoji. */
  glyphs?: string[];
  /** Distance multiplier, 0.5 to 2 (default 1). */
  spread?: number;
  /** Milliseconds; defaults to --dur-celebrate. */
  duration?: number;
}
/** Throw confetti in the theme's colours. No-op under reduced motion. */
export declare function celebrate(options?: CelebrateOptions): Promise<void>;

/** Listen for the Konami code (keys, or swipes then two taps). Returns a stop function. */
export declare function konami(onunlock: () => void, options?: { target?: EventTarget }): () => void;

/** Unlock something after several quick taps on an element. */
export declare const secretTaps: Action<
  HTMLElement,
  { count?: number; within?: number; onunlock: () => void; onprogress?: (taps: number) => void }
>;
/** Unlock something by holding an element down. */
export declare const longPress: Action<HTMLElement, { ms?: number; onunlock: () => void }>;
/** Count a number up on the slow spatial spring. */
export declare const countUp: Action<
  HTMLElement,
  { value: number; decimals?: number; format?: (n: number) => string }
>;

export interface Eggs {
  readonly total: number;
  found(): string[];
  find(id: string): { isNew: boolean; found: number; total: number };
  reset(): void;
}
/** Remember which easter eggs have been found in an app, on this device. */
export declare function createEggs(app: string, ids: readonly string[]): Eggs;
