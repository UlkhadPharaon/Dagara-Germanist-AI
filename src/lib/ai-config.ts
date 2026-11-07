/**
 * "Bring your own key" configuration.
 *
 * The key is stored in this browser only (`localStorage`) and is sent straight
 * to the provider it belongs to — never to our own servers. This is the same
 * model as OpenRouter's or Anthropic's own consoles: a browser-held secret is
 * exposed to that browser, which is the trade-off the user accepts when they
 * choose BYOK over the bundled proxy.
 */

import { DEFAULT_PROVIDER_ID, getProvider } from './providers';
import { readJson, readString, storageKeys, writeJson, writeString } from './storage';

export interface AiConfig {
  providerId: string;
  apiKey: string;
  modelId: string;
}

const CONFIG_KEY = `${storageKeys.aiModel}:byok`;
const MODEL_KEY = `${storageKeys.aiModel}:byok-model`;
const PROVIDER_KEY = `${storageKeys.aiModel}:byok-provider`;
const KEY_KEY = `${storageKeys.aiModel}:byok-key`;

interface StoredConfig {
  providerId?: unknown;
  apiKey?: unknown;
  modelId?: unknown;
}

/** Reads the BYOK configuration, or null when it is incomplete. */
export function getAiConfig(): AiConfig | null {
  const stored = readJson<StoredConfig>(CONFIG_KEY);
  if (!stored) return null;

  const providerId = typeof stored.providerId === 'string' ? stored.providerId : null;
  const apiKey = typeof stored.apiKey === 'string' ? stored.apiKey : null;
  const modelId = typeof stored.modelId === 'string' ? stored.modelId : null;

  if (!providerId || !apiKey || !modelId) return null;
  if (!getProvider(providerId)) return null;

  return { providerId, apiKey, modelId };
}

/** Persists a complete configuration; a null clears it. */
export function setAiConfig(config: AiConfig | null): void {
  if (!config) {
    writeJson(CONFIG_KEY, null);
    removeKey(KEY_KEY);
    return;
  }

  if (!getProvider(config.providerId)) {
    throw new Error(`Fournisseur inconnu : ${config.providerId}`);
  }

  writeJson(CONFIG_KEY, {
    providerId: config.providerId,
    apiKey: config.apiKey,
    modelId: config.modelId,
  });
  writeString(PROVIDER_KEY, config.providerId);
  writeString(MODEL_KEY, config.modelId);
  writeString(KEY_KEY, config.apiKey);
}

export function clearAiConfig(): void {
  setAiConfig(null);
}

function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Last provider/model the user selected, used to pre-fill the form. */
export function getLastSelection(): { providerId: string; modelId: string | null } {
  const providerId = readString(PROVIDER_KEY) ?? DEFAULT_PROVIDER_ID;
  return {
    providerId: getProvider(providerId) ? providerId : DEFAULT_PROVIDER_ID,
    modelId: readString(MODEL_KEY),
  };
}

/** True when BYOK is fully configured. */
export function isByokActive(): boolean {
  return getAiConfig() !== null;
}

export { DEFAULT_PROVIDER_ID };
