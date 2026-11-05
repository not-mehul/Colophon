import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from '../../src/state/settings';

describe('settings', () => {
  it('fills in defaults and drops values that do not fit', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({ maxCatalogResults: 12, minCoverWidth: 999, compression: '9', purgeOrphans: true, lastEditionId: 'a' })).toEqual({
      ...DEFAULT_SETTINGS,
      maxCatalogResults: 12,
      purgeOrphans: true,
      lastEditionId: 'a',
    });
  });

  it('reads the theme Colophon 2 stored', () => {
    expect(mergeSettings({ theme: 'dawn' }).theme).toBe('light');
    expect(mergeSettings({ theme: 'dusk' }).theme).toBe('dark');
  });
});
