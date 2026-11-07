import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson, readString, removeKey, writeJson, writeString } from '../storage';

/**
 * The storage layer must never throw: a corrupted entry is reported and
 * discarded so the caller falls back to a default instead of crashing.
 */
describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('writes and reads back a JSON value', () => {
    writeJson('key', { a: 1, b: ['x'] });
    expect(readJson<{ a: number; b: string[] }>('key')).toEqual({ a: 1, b: ['x'] });
  });

  it('returns null for a missing key', () => {
    expect(readJson('absent')).toBeNull();
    expect(readString('absent')).toBeNull();
  });

  it('discards a corrupted entry instead of throwing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.localStorage.setItem('broken', '{pas du json');

    expect(readJson('broken')).toBeNull();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('discards JSON primitives when an object is expected', () => {
    window.localStorage.setItem('number', '42');
    const validator = (value: unknown): number | null => (typeof value === 'number' ? value : null);

    expect(readJson<number>('number', validator)).toBe(42);
    expect(readJson<{ a: number }>('number')).toEqual(42);
  });

  it('applies the validator to a valid payload', () => {
    writeJson('projects', [{ id: '1' }]);
    const validator = (value: unknown): string[] | null =>
      Array.isArray(value)
        ? value
            .filter(entry => typeof entry === 'object' && entry !== null && 'id' in entry)
            .map(entry => String((entry as { id: unknown }).id))
        : null;

    expect(readJson<string[]>('projects', validator)).toEqual(['1']);
    expect(readJson<string[]>('projects', () => null)).toBeNull();
  });

  it('writes and reads plain strings', () => {
    writeString('model', 'meta/llama-3.1-70b-instruct');
    expect(readString('model')).toBe('meta/llama-3.1-70b-instruct');
  });

  it('removes a key', () => {
    writeString('temp', 'x');
    removeKey('temp');
    expect(readString('temp')).toBeNull();
  });

  it('survives a localStorage that throws (private mode)', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => writeJson('key', { a: 1 })).not.toThrow();
    expect(() => writeString('key', 'valeur')).not.toThrow();

    setItem.mockRestore();
    consoleError.mockRestore();
  });
});
