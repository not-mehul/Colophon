// Editorial Dusk & Dawn, Expressive: shapes, celebrations and easter eggs
// (style.md §6.4 and §11.3). Shared by every app through this package.
//
// Nothing here names a colour: confetti takes token names and reads them
// from the page, so it follows the theme. Everything honours
// prefers-reduced-motion: a celebration becomes a no-op, a flourish does not
// play, and the loading shape holds still.

/** True when the person has asked the system for less motion. */
export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------- shapes ----------
//
// The Material 3 Expressive shape set, as radial functions r(θ) in 0..1.
// Every shape is sampled with the same number of points, so a CSS clip-path
// polygon can morph from any shape to any other.

const TAU = Math.PI * 2;

/**
 * Regular polygon with n sides and soft corners, as a radial function. The
 * hard max over the sides becomes a p-norm, which rounds every corner while
 * keeping the sides straight. `vertexUp` puts a corner at the top.
 */
function polygon(n, softness = 10, vertexUp = false) {
  const normals = Array.from({ length: n }, (_, i) => (i / n) * TAU + (vertexUp ? Math.PI / n : 0));
  const raw = (t) => {
    let sum = 0;
    for (const phi of normals) sum += Math.max(0, Math.cos(t - phi)) ** softness;
    return 1 / sum ** (1 / softness);
  };
  let peak = 0;
  for (let i = 0; i < 360; i++) peak = Math.max(peak, raw((i / 360) * TAU));
  return (t) => raw(t) / peak;
}

const RADIAL = {
  circle: () => 1,
  'cookie-4': (t) => 0.86 + 0.14 * Math.cos(4 * t),
  'cookie-6': (t) => 0.88 + 0.12 * Math.cos(6 * t),
  'cookie-7': (t) => 0.88 + 0.12 * Math.cos(7 * t),
  'cookie-9': (t) => 0.9 + 0.1 * Math.cos(9 * t),
  'cookie-12': (t) => 0.92 + 0.08 * Math.cos(12 * t),
  sunny: (t) => 0.9 + 0.1 * Math.sign(Math.cos(8 * t)) * Math.abs(Math.cos(8 * t)) ** 0.6,
  'very-sunny': (t) => 0.82 + 0.18 * Math.abs(Math.cos(4 * t)) ** 2,
  'clover-4': (t) => 0.62 + 0.38 * Math.abs(Math.cos(2 * t)) ** 0.5,
  'clover-8': (t) => 0.78 + 0.22 * Math.abs(Math.cos(4 * t)) ** 0.6,
  flower: (t) => 0.76 + 0.24 * Math.abs(Math.cos(3 * t)) ** 0.8,
  'soft-burst': (t) => 0.84 + 0.16 * Math.cos(10 * t) ** 3,
  puffy: (t) => 0.8 + 0.2 * Math.abs(Math.cos(5 * t)) ** 0.4,
  triangle: polygon(3, 7, true),
  square: polygon(4, 10),
  pentagon: polygon(5, 12, true),
  diamond: polygon(4, 10, true),
  gem: (() => {
    const hex = polygon(6, 14, true);
    return (t) => hex(t) * (1 - 0.08 * Math.cos(2 * t) ** 2);
  })(),
};

// Shapes that aren't radial are traced by a parameter instead, still with the
// same number of points so they morph with the rest. Points are in -1..1.
const TRACED = {
  heart: (u) => {
    const x = 16 * Math.sin(u) ** 3;
    const y = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
    return [x / 17, -(y - 2.5) / 15];
  },
};

/** The names of the Expressive shapes, for LoadingIndicator, confetti and clip paths. */
export const SHAPES = Object.freeze([...Object.keys(RADIAL), ...Object.keys(TRACED)]);

/** The loading indicator's sequence (Material 3 Expressive's default seven, adapted). */
export const LOADING_SHAPES = Object.freeze(['soft-burst', 'cookie-9', 'pentagon', 'puffy', 'very-sunny', 'cookie-4', 'gem']);

/**
 * A shape as polygon points in percent of its box.
 * @param {string} name one of SHAPES
 * @param {number} [points=48]
 * @param {number} [rotate=0] degrees
 * @returns {Array<[number, number]>}
 */
export function shapePoints(name, points = 48, rotate = 0) {
  const turn = (rotate * Math.PI) / 180 - Math.PI / 2;
  const out = [];
  const traced = TRACED[name];
  if (traced) {
    const [c, s] = [Math.cos(turn + Math.PI / 2), Math.sin(turn + Math.PI / 2)];
    for (let i = 0; i < points; i++) {
      const [x, y] = traced((i / points) * TAU);
      out.push([50 + 50 * (x * c - y * s), 50 + 50 * (x * s + y * c)]);
    }
    return out;
  }
  const r = RADIAL[name] ?? RADIAL.circle;
  for (let i = 0; i < points; i++) {
    const t = (i / points) * TAU;
    const radius = Math.max(0, Math.min(1, r(t)));
    out.push([50 + 50 * radius * Math.cos(t + turn), 50 + 50 * radius * Math.sin(t + turn)]);
  }
  return out;
}

/**
 * A CSS clip-path for a shape: `clip-path: ${shapeClipPath('cookie-9')}`.
 * Two shapes with the same `points` morph smoothly into each other.
 */
export function shapeClipPath(name, points = 48, rotate = 0) {
  const pts = shapePoints(name, points, rotate).map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`);
  return `polygon(${pts.join(', ')})`;
}

// ---------- springs ----------

/** A CSS time ("320ms", "1.4s", ".6s": minifiers rewrite them) in milliseconds. */
function toMs(value, fallback = 0) {
  const m = /^\s*(-?[\d.]+)\s*(ms|s)?\s*$/.exec(value ?? '');
  if (!m) return fallback;
  const n = parseFloat(m[1]);
  return m[2] === 's' ? n * 1000 : n;
}

/** Read a spring's easing and duration from the theme, e.g. spring('spatial-default'). */
export function spring(name) {
  const style = getComputedStyle(document.documentElement);
  const easing = style.getPropertyValue(`--spring-${name}`).trim() || 'ease-out';
  const duration = toMs(style.getPropertyValue(`--spring-${name}-dur`));
  return { easing, duration };
}

// ---------- one-shot flourishes ----------

const FLOURISHES = ['pop', 'wiggle', 'jelly', 'tada', 'spin-once', 'flip', 'heartbeat'];

/**
 * Play a one-shot flourish on an element: play(node, 'wiggle'). Plays again
 * if called again. Does nothing under reduced motion.
 * @param {Element | null | undefined} node
 * @param {'pop' | 'wiggle' | 'jelly' | 'tada' | 'spin-once' | 'flip' | 'heartbeat'} name
 */
export function play(node, name) {
  if (!node || prefersReducedMotion() || !FLOURISHES.includes(name)) return;
  const cls = `dd-${name}`;
  node.classList.remove(cls);
  // Force a style flush so the animation restarts.
  void (/** @type {HTMLElement} */ (node).offsetWidth);
  node.classList.add(cls);
  node.addEventListener('animationend', () => node.classList.remove(cls), { once: true });
}

// ---------- celebrations ----------

const DEFAULT_COLOURS = ['--accent-bright', '--accent-amber', '--accent-sage', '--text-heading'];
const CONFETTI_SHAPES = ['circle', 'cookie-4', 'pentagon', 'diamond', 'clover-4', 'sunny', 'triangle', 'heart'];

function originPoint(origin) {
  if (!origin) return { x: innerWidth / 2, y: innerHeight * 0.35 };
  if (typeof Element !== 'undefined' && origin instanceof Element) {
    const r = origin.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return origin;
}

/**
 * Throw confetti. Returns a promise that settles when the last piece lands.
 * A no-op under reduced motion.
 *
 * @param {object} [options]
 * @param {Element | {x: number, y: number}} [options.origin] where it bursts from (default: upper centre)
 * @param {number} [options.count=60]
 * @param {string[]} [options.colours] colour token names, e.g. ['--accent-bright', '--accent-sage']
 * @param {string[]} [options.shapes] Expressive shape names for the pieces
 * @param {string[]} [options.glyphs] text pieces (typographic ornaments, letters, numerals) mixed in
 * @param {number} [options.spread=1] how far it flies, 0.5 to 2
 * @param {number} [options.duration] ms; defaults to --dur-celebrate
 * @returns {Promise<void>}
 */
export function celebrate(options = {}) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return Promise.resolve();
  const {
    count = 60,
    colours = DEFAULT_COLOURS,
    shapes = CONFETTI_SHAPES,
    glyphs = [],
    spread = 1,
  } = options;
  const style = getComputedStyle(document.documentElement);
  const duration = options.duration ?? toMs(style.getPropertyValue('--dur-celebrate'), 1400);
  const { x, y } = originPoint(options.origin);

  const layer = document.createElement('div');
  layer.className = 'dd-confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const animations = [];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    const glyph = glyphs.length && Math.random() < 0.35 ? pick(glyphs) : null;
    piece.className = glyph ? 'dd-confetti is-glyph' : 'dd-confetti';
    const colour = `var(${pick(colours)})`;
    if (glyph) {
      piece.textContent = glyph;
      piece.style.color = colour;
    } else {
      const size = 8 + Math.random() * 8;
      piece.style.width = `${size}px`;
      piece.style.height = `${size}px`;
      piece.style.background = colour;
      piece.style.clipPath = shapeClipPath(pick(shapes), 24, Math.random() * 360);
    }
    layer.append(piece);

    // A little ballistics: a burst upward and out, then gravity and drift.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const speed = (280 + Math.random() * 420) * spread;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const gravity = 900;
    const spin = (Math.random() - 0.5) * 1080;
    const life = (duration * (0.75 + Math.random() * 0.5)) / 1000;
    const frames = [];
    const steps = 14;
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * life;
      const drag = 1 - Math.min(0.6, t * 0.5);
      frames.push({
        transform: `translate(${x + vx * t * drag}px, ${y + vy * t + 0.5 * gravity * t * t}px) rotate(${spin * t}deg) scale(${s === 0 ? 0.4 : 1})`,
        opacity: s > steps * 0.75 ? 1 - (s - steps * 0.75) / (steps * 0.25) : 1,
      });
    }
    animations.push(piece.animate(frames, { duration: life * 1000, easing: 'linear', fill: 'forwards' }).finished);
  }
  return Promise.allSettled(animations).then(() => layer.remove());
}

// ---------- easter eggs ----------

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const SWIPES = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right'];

/**
 * Listen for the Konami code: the keys, or on a touch screen the eight swipes
 * (up up down down left right left right) followed by two taps.
 * Returns a function that stops listening.
 * @param {() => void} onunlock
 * @param {{ target?: EventTarget }} [options]
 */
export function konami(onunlock, { target = typeof window === 'undefined' ? undefined : window } = {}) {
  if (!target) return () => {};
  let keys = 0;
  let swipes = 0;
  let taps = 0;
  let start = null;

  const onkey = (event) => {
    const key = /** @type {KeyboardEvent} */ (event).key;
    const want = KONAMI[keys];
    keys = key.toLowerCase() === want?.toLowerCase() ? keys + 1 : key === KONAMI[0] ? 1 : 0;
    if (keys === KONAMI.length) {
      keys = 0;
      onunlock();
    }
  };
  const ondown = (event) => {
    const e = /** @type {PointerEvent} */ (event);
    if (e.pointerType === 'mouse') return;
    start = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  const onup = (event) => {
    const e = /** @type {PointerEvent} */ (event);
    if (!start || e.pointerType === 'mouse') return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const quick = e.timeStamp - start.t < 600;
    start = null;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      if (swipes === SWIPES.length) {
        taps++;
        if (taps === 2) {
          swipes = 0;
          taps = 0;
          onunlock();
        }
      } else {
        swipes = 0;
      }
      return;
    }
    if (!quick || dist < 40) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    taps = 0;
    swipes = dir === SWIPES[swipes] ? swipes + 1 : dir === SWIPES[0] ? 1 : 0;
  };

  target.addEventListener('keydown', onkey);
  target.addEventListener('pointerdown', ondown, { passive: true });
  target.addEventListener('pointerup', onup, { passive: true });
  return () => {
    target.removeEventListener('keydown', onkey);
    target.removeEventListener('pointerdown', ondown);
    target.removeEventListener('pointerup', onup);
  };
}

/**
 * Svelte action: a secret unlocked by tapping an element several times in
 * quick succession. `<h1 use:secretTaps={{ count: 7, onunlock }}>`.
 * The element stays whatever it was; taps on it do what they always did.
 * @param {HTMLElement} node
 * @param {{ count?: number, within?: number, onunlock: () => void, onprogress?: (n: number) => void }} params
 */
export function secretTaps(node, params) {
  let options = params;
  let times = [];
  const onclick = (event) => {
    const now = event.timeStamp;
    const { count = 7, within = 2500 } = options;
    times = [...times.filter((t) => now - t < within), now];
    options.onprogress?.(times.length);
    if (times.length >= count) {
      times = [];
      options.onunlock();
    }
  };
  node.addEventListener('click', onclick);
  return {
    update(next) {
      options = next;
    },
    destroy() {
      node.removeEventListener('click', onclick);
    },
  };
}

/**
 * Svelte action: a secret unlocked by holding an element down.
 * @param {HTMLElement} node
 * @param {{ ms?: number, onunlock: () => void }} params
 */
export function longPress(node, params) {
  let options = params;
  let timer = 0;
  const cancel = () => clearTimeout(timer);
  const ondown = () => {
    cancel();
    timer = setTimeout(() => options.onunlock(), options.ms ?? 1200);
  };
  node.addEventListener('pointerdown', ondown);
  for (const e of ['pointerup', 'pointerleave', 'pointercancel']) node.addEventListener(e, cancel);
  return {
    update(next) {
      options = next;
    },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', ondown);
      for (const e of ['pointerup', 'pointerleave', 'pointercancel']) node.removeEventListener(e, cancel);
    },
  };
}

/**
 * Remember which easter eggs this person has found, per app, on this device.
 *
 *   const eggs = createEggs('mise', ['konami', 'yes-chef', 'bon-appetit']);
 *   const { isNew, found, total } = eggs.find('konami');
 *   if (isNew) toast(`Easter egg found: ${found} of ${total}.`);
 *
 * @param {string} app
 * @param {readonly string[]} ids
 */
export function createEggs(app, ids) {
  const key = `dusk-dawn:eggs:${app}`;
  const read = () => {
    try {
      const list = JSON.parse(localStorage.getItem(key) ?? '[]');
      return new Set(Array.isArray(list) ? list.filter((id) => ids.includes(id)) : []);
    } catch {
      return new Set();
    }
  };
  return {
    total: ids.length,
    /** The ids found so far. */
    found: () => [...read()],
    /** Mark one found. */
    find(id) {
      const seen = read();
      const isNew = ids.includes(id) && !seen.has(id);
      if (isNew) {
        seen.add(id);
        try {
          localStorage.setItem(key, JSON.stringify([...seen]));
        } catch {
          // Private mode or full storage: the egg still hatches, it just isn't counted.
        }
      }
      return { isNew, found: seen.size, total: ids.length };
    },
    reset() {
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing to forget.
      }
    },
  };
}

/**
 * Svelte action: count a number up from zero (or from its last value) on a
 * spring, the first time it is shown and whenever it changes.
 * `<span use:countUp={{ value: score }}>{score}</span>`
 * @param {HTMLElement} node
 * @param {{ value: number, decimals?: number, format?: (n: number) => string }} params
 */
export function countUp(node, params) {
  let from = 0;
  let frame = 0;
  const run = ({ value, decimals = 0, format }) => {
    cancelAnimationFrame(frame);
    const show = (n) => (node.textContent = format ? format(n) : n.toFixed(decimals));
    if (prefersReducedMotion() || !Number.isFinite(value)) {
      show(value);
      from = value;
      return;
    }
    const { easing, duration } = spring('spatial-slow');
    const curve = parseLinear(easing);
    const start = performance.now();
    const begin = from;
    const tickFrame = (now) => {
      const p = Math.min(1, (now - start) / Math.max(duration, 1));
      show(begin + (value - begin) * curve(p));
      if (p < 1) frame = requestAnimationFrame(tickFrame);
      else from = value;
    };
    frame = requestAnimationFrame(tickFrame);
  };
  run(params);
  return {
    update: run,
    destroy: () => cancelAnimationFrame(frame),
  };
}

/** Evaluate a CSS linear() easing (evenly spaced stops) at p in 0..1. */
function parseLinear(easing) {
  const m = /^linear\((.*)\)$/.exec(easing);
  if (!m) return (p) => 1 - (1 - p) ** 3;
  const stops = m[1].split(',').map((v) => parseFloat(v));
  return (p) => {
    const i = Math.min(stops.length - 2, Math.floor(p * (stops.length - 1)));
    const f = p * (stops.length - 1) - i;
    return stops[i] + (stops[i + 1] - stops[i]) * f;
  };
}
