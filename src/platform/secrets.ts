// API keys in the platform's secure storage: the iOS Keychain or an Android
// Keystore-encrypted store. In a browser the plugin falls back to
// localStorage, which is as private as the browser profile and no more.

import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { EMPTY_SECRETS, SECRET_KEYS, type SecretKey, type Secrets } from '../state/settings';

const PREFIX = 'colophon.';
let ready: Promise<void> | null = null;

function prepare(): Promise<void> {
  ready ??= SecureStorage.setKeyPrefix(PREFIX).catch(() => undefined);
  return ready;
}

export async function loadSecrets(): Promise<Secrets> {
  await prepare();
  const out: Secrets = { ...EMPTY_SECRETS };
  for (const key of SECRET_KEYS) {
    try {
      const value = await SecureStorage.getItem(key);
      if (value) out[key] = value;
    } catch {
      // Unreadable after a restore to another device: the key has to be entered again.
    }
  }
  return out;
}

export async function saveSecret(key: SecretKey, value: string): Promise<void> {
  await prepare();
  if (value) await SecureStorage.setItem(key, value);
  else await SecureStorage.removeItem(key);
}
