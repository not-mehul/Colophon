import { describe, expect, it } from 'vitest';
import { readingMinutes, readingTime } from '../../src/lib/format';
import { shortcut } from '../../src/lib/keys';

const key = (k: string, init: KeyboardEventInit = {}, target?: HTMLElement) => {
  const e = new KeyboardEvent('keydown', { key: k, ...init });
  if (target) Object.defineProperty(e, 'target', { value: target });
  return e;
};
const onBench = { overlay: false, edition: true };

describe('keyboard shortcuts', () => {
  it('binds, opens and undoes with the modifier', () => {
    expect(shortcut(key('s', { ctrlKey: true }), onBench)).toBe('bind');
    expect(shortcut(key('S', { metaKey: true }), onBench)).toBe('bind');
    expect(shortcut(key('o', { ctrlKey: true }), onBench)).toBe('open');
    expect(shortcut(key('z', { ctrlKey: true }), onBench)).toBe('undo');
    expect(shortcut(key('s', { ctrlKey: true }), { overlay: false, edition: false })).toBeNull();
  });

  it('switches tabs with digits, but never while typing', () => {
    expect(shortcut(key('3'), onBench)).toEqual({ tab: 'chapters' });
    expect(shortcut(key('p'), onBench)).toBe('proof');
    const input = document.createElement('input');
    expect(shortcut(key('3', {}, input), onBench)).toBeNull();
    // A field keeps its own undo.
    expect(shortcut(key('z', { ctrlKey: true }, input), onBench)).toBeNull();
  });

  it('leaves single keys alone while a sheet is open', () => {
    expect(shortcut(key('2'), { overlay: true, edition: true })).toBeNull();
    expect(shortcut(key('s', { ctrlKey: true }), { overlay: true, edition: true })).toBeNull();
  });
});

describe('reading time', () => {
  it('rounds to minutes and hours', () => {
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(10)).toBe(1);
    expect(readingTime(readingMinutes(2380))).toBe('10 min');
    expect(readingTime(135)).toBe('2 h 15 min');
    expect(readingTime(120)).toBe('2 h');
  });
});
