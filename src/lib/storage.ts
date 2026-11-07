/**
 * Typed access layer over browser `localStorage`.
 *
 * Every read is defensive: a corrupted entry must never crash the app, it is
 * reported and discarded so the caller falls back to a default value.
 * This module is the single swap point for the Supabase migration (Phase 2).
 */

import { STORAGE_KEYS } from './constants';

const isBrowser = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

/**
 * Reads and parses a JSON value from localStorage.
 * Returns `null` when the key is absent or its content is unusable.
 */
export function readJson<T>(key: string, validator?: (value: unknown) => T | null): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (validator) return validator(parsed);
    return parsed as T;
  } catch (error) {
    console.error(`localStorage: entrée illisible ignorée pour la clé « ${key} ».`, error);
    return null;
  }
}

/** Writes a JSON value to localStorage, swallowing quota/private-mode errors. */
export function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`localStorage: impossible d'écrire la clé « ${key} ».`, error);
  }
}

export function readString(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.error(`localStorage: impossible d'écrire la clé « ${key} ».`, error);
  }
}

export function removeKey(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const storageKeys = STORAGE_KEYS;
