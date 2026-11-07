import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAiConfig,
  getAiConfig,
  getLastSelection,
  isByokActive,
  setAiConfig,
} from '../ai-config';
import { getSelectedModel } from '../api';

/**
 * BYOK configuration must never leave a half-stored state behind, and an
 * unknown provider must be refused rather than silently breaking calls.
 */
describe('ai-config', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('is inactive by default', () => {
    expect(getAiConfig()).toBeNull();
    expect(isByokActive()).toBe(false);
  });

  it('round-trips a valid configuration', () => {
    setAiConfig({ providerId: 'openrouter', apiKey: 'sk-or-v1-test', modelId: 'openai/gpt-4o' });

    expect(getAiConfig()).toEqual({
      providerId: 'openrouter',
      apiKey: 'sk-or-v1-test',
      modelId: 'openai/gpt-4o',
    });
    expect(isByokActive()).toBe(true);
  });

  it('refuses an unknown provider', () => {
    expect(() => setAiConfig({ providerId: 'nope', apiKey: 'k', modelId: 'm' })).toThrow(
      /Fournisseur inconnu/
    );
    expect(getAiConfig()).toBeNull();
  });

  it('ignores an incomplete stored configuration', () => {
    window.localStorage.setItem(
      'dagara-ai-model:byok',
      JSON.stringify({ providerId: 'openrouter' })
    );
    expect(getAiConfig()).toBeNull();
  });

  it('ignores a configuration for a provider that no longer exists', () => {
    window.localStorage.setItem(
      'dagara-ai-model:byok',
      JSON.stringify({ providerId: 'disparu', apiKey: 'k', modelId: 'm' })
    );
    expect(getAiConfig()).toBeNull();
  });

  it('clears everything on removal', () => {
    setAiConfig({
      providerId: 'nvidia',
      apiKey: 'nvapi-test',
      modelId: 'meta/llama-3.2-90b-vision',
    });
    clearAiConfig();

    expect(getAiConfig()).toBeNull();
    expect(isByokActive()).toBe(false);
    expect(window.localStorage.getItem('dagara-ai-model:byok-key')).toBeNull();
  });

  it('remembers the last provider/model for the form', () => {
    setAiConfig({ providerId: 'anthropic', apiKey: 'sk-ant-x', modelId: 'claude-sonnet-4' });

    expect(getLastSelection()).toEqual({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4',
    });
  });

  it('falls back to a known provider in the last selection', () => {
    window.localStorage.setItem('dagara-ai-model:byok-provider', ' fantome ');
    const selection = getLastSelection();

    expect(selection.providerId).not.toBe(' fantome ');
    expect(selection.modelId).toBeNull();
  });

  it('survives corrupted storage', () => {
    window.localStorage.setItem('dagara-ai-model:byok', '{corrompu');
    expect(getAiConfig()).toBeNull();
  });
});

describe('model selection precedence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses the bundled-proxy model when no key is configured', () => {
    window.localStorage.setItem('dagara-ai-model', 'meta/llama-3.1-70b-instruct');
    expect(getSelectedModel()).toBe('meta/llama-3.1-70b-instruct');
  });

  it('uses the BYOK model once a key is configured', () => {
    window.localStorage.setItem('dagara-ai-model', 'meta/llama-3.1-70b-instruct');
    setAiConfig({ providerId: 'openrouter', apiKey: 'sk-or-v1-test', modelId: 'openai/gpt-4o' });

    expect(getSelectedModel()).toBe('openai/gpt-4o');

    clearAiConfig();
    // Removing the key restores the proxy model.
    expect(getSelectedModel()).toBe('meta/llama-3.1-70b-instruct');
  });

  it('never logs the key', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    setAiConfig({
      providerId: 'groq',
      apiKey: 'gsk_secret_value',
      modelId: 'llama-3.2-90b-vision',
    });

    getSelectedModel();
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('gsk_secret_value'));

    consoleSpy.mockRestore();
  });
});
