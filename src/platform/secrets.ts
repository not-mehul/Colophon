// API keys, kept in this browser's localStorage: as private as the browser
// profile and no more. Settings says so beside the fields.

import { EMPTY_SECRETS, SECRET_KEYS, type SecretKey, type Secrets } from '../state/settings';

const PREFIX = 'colophon.';

export async function loadSecrets(): Promise<Secrets> {
  const out: Secrets = { ...EMPTY_SECRETS };
  for (const key of SECRET_KEYS) {
    try {
      const value = localStorage.getItem(PREFIX + key);
      if (value) out[key] = value;
    } catch {
      // Storage is blocked (a private window): the key has to be entered again.
    }
  }
  return out;
}

export async function saveSecret(key: SecretKey, value: string): Promise<void> {
  try {
    if (value) localStorage.setItem(PREFIX + key, value);
    else localStorage.removeItem(PREFIX + key);
  } catch {
    // Storage is blocked: the key lasts until the page closes.
  }
}
