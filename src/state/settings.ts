// Settings: everything but the API keys is stored in IndexedDB; the keys go to
// the platform's secure storage (Keychain on iOS, the Android Keystore).

import { DEFAULT_RENAME, DEFAULT_TEMPLATE } from '../epub/filename';

export type ThemeSetting = 'system' | 'dark' | 'light';
export type PlateStyle = 'classic' | 'minimal' | 'noir' | 'eink';
export type BenchSort = 'recent' | 'score' | 'title';

export interface Settings {
  theme: ThemeSetting;
  defaultPlate: PlateStyle;
  maxCatalogResults: 6 | 8 | 12;
  minCoverWidth: 800 | 1000 | 1200;
  compression: 3 | 6 | 9;
  dualCoverTags: boolean;
  purgeOrphans: boolean;
  corsProxyUrl: string;
  customCatalogUrl: string;
  exportTemplate: string;
  renamePattern: string;
  shelfOrder: string;
  /** How the bench is ordered. */
  benchSort: BenchSort;
  /** The edition on the bench when the app last closed. */
  lastEditionId: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  defaultPlate: 'classic',
  maxCatalogResults: 8,
  minCoverWidth: 1000,
  compression: 6,
  dualCoverTags: true,
  purgeOrphans: false,
  corsProxyUrl: '',
  customCatalogUrl: '',
  exportTemplate: DEFAULT_TEMPLATE,
  renamePattern: DEFAULT_RENAME,
  shelfOrder: '01',
  benchSort: 'recent',
  lastEditionId: null,
};

const CHOICES = {
  theme: ['system', 'dark', 'light'],
  defaultPlate: ['classic', 'minimal', 'noir', 'eink'],
  maxCatalogResults: [6, 8, 12],
  minCoverWidth: [800, 1000, 1200],
  compression: [3, 6, 9],
  benchSort: ['recent', 'score', 'title'],
} as const;

/** Stored settings over the defaults, dropping anything a newer or older version left that doesn't fit. */
export function mergeSettings(stored: Partial<Record<keyof Settings, unknown>> | undefined): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!stored) return out;
  const writable = out as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = stored[key];
    if (value === undefined) continue;
    const choices = (CHOICES as Record<string, readonly unknown[]>)[key];
    if (choices) {
      if (choices.includes(value)) writable[key] = value;
    } else if (typeof value === typeof DEFAULT_SETTINGS[key] || (key === 'lastEditionId' && (value === null || typeof value === 'string'))) {
      writable[key] = value;
    }
  }
  // Colophon 2 stored the theme as "dusk" or "dawn".
  if (stored.theme === 'dusk') out.theme = 'dark';
  if (stored.theme === 'dawn') out.theme = 'light';
  return out;
}

export const SECRET_KEYS = ['googleApiKey', 'isbndbApiKey', 'customCatalogKey'] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];
export type Secrets = Record<SecretKey, string>;
export const EMPTY_SECRETS: Secrets = { googleApiKey: '', isbndbApiKey: '', customCatalogKey: '' };
