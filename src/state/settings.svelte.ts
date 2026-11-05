// The settings in use, loaded once at start and saved on every change.

import { loadSecrets, saveSecret } from '../platform/secrets';
import { db } from './db';
import { DEFAULT_SETTINGS, EMPTY_SECRETS, mergeSettings, type SecretKey, type Secrets, type Settings } from './settings';

class SettingsState {
  value = $state<Settings>({ ...DEFAULT_SETTINGS });
  secrets = $state<Secrets>({ ...EMPTY_SECRETS });

  async load(): Promise<void> {
    const [stored, secrets] = await Promise.all([db.settings.get('settings').catch(() => undefined), loadSecrets().catch(() => EMPTY_SECRETS)]);
    this.value = mergeSettings(stored?.value);
    this.secrets = { ...secrets };
  }

  async update(patch: Partial<Settings>): Promise<void> {
    Object.assign(this.value, patch);
    await db.settings.put({ id: 'settings', value: $state.snapshot(this.value) });
  }

  async setSecret(key: SecretKey, value: string): Promise<void> {
    this.secrets[key] = value.trim();
    await saveSecret(key, value.trim());
  }

  /** The keys and URLs the catalogs need. */
  get catalogKeys() {
    return {
      googleApiKey: this.secrets.googleApiKey,
      isbndbApiKey: this.secrets.isbndbApiKey,
      customCatalogKey: this.secrets.customCatalogKey,
      customCatalogUrl: this.value.customCatalogUrl,
    };
  }

  get activeKeys(): number {
    return Object.values(this.secrets).filter(Boolean).length;
  }
}

export const settings = new SettingsState();
