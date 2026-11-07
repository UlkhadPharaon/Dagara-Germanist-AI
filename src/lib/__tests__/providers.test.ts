import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { first } from '../../test/helpers';
import {
  buildProviderTarget,
  describeCapabilities,
  FALLBACK_PROVIDER,
  fetchProviderModels,
  getProvider,
  isUsableModel,
  matchesOmniMatcher,
  PROVIDERS,
  readCompletionText,
  REQUIRED_INPUT_MODALITIES,
  type AiModel,
} from '../providers';

const CONTENT_PART = {
  type: 'image_url' as const,
  image_url: { url: 'data:image/png;base64,QUJD' },
};

const openRouterPayload = {
  data: [
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      context_length: 128000,
      architecture: { modality: 'text+image->text', input_modalities: ['text', 'image'] },
      supported_parameters: ['tools', 'temperature'],
    },
    {
      id: 'openai/gpt-4o-audio-preview',
      name: 'GPT-4o Audio',
      architecture: {
        modality: 'text+image+audio->text',
        input_modalities: ['text', 'image', 'audio'],
      },
      supported_parameters: ['tools'],
    },
    {
      id: 'some-vendor/text-only',
      name: 'Text only',
      architecture: { modality: 'text->text', input_modalities: ['text'] },
      supported_parameters: ['tools'],
    },
    {
      id: 'openai/o1',
      name: 'o1 (no tools)',
      architecture: { input_modalities: ['text', 'image'] },
      supported_parameters: ['temperature'],
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('provider registry', () => {
  it('ships the providers the app can actually call', () => {
    expect(PROVIDERS.map(provider => provider.id)).toEqual([
      'openrouter',
      'nvidia',
      'openai',
      'anthropic',
      'groq',
      'mistral',
    ]);
  });

  it('gives every provider a help URL and a base URL', () => {
    for (const provider of PROVIDERS) {
      expect(provider.keyHelpUrl).toMatch(/^https:\/\//);
      expect(provider.baseUrl).toMatch(/^https:\/\//);
      expect(provider.baseUrl.endsWith('/')).toBe(false);
    }
  });

  it('exposes Anthropic with its own dialect, everything else OpenAI-compatible', () => {
    expect(getProvider('anthropic')?.dialect).toBe('anthropic');
    for (const provider of PROVIDERS.filter(item => item.id !== 'anthropic')) {
      expect(provider.dialect).toBe('openai');
    }
  });

  it('knows the key prefix of each provider', () => {
    expect(getProvider('openrouter')?.keyPrefix).toBe('sk-or-v1-');
    expect(getProvider('nvidia')?.keyPrefix).toBe('nvapi-');
    expect(getProvider('anthropic')?.keyPrefix).toBe('sk-ant-');
  });

  it('returns undefined for an unknown provider', () => {
    expect(getProvider('nope')).toBeUndefined();
  });
});

describe('matchesOmniMatcher', () => {
  it('matches exact ids and prefixes', () => {
    expect(matchesOmniMatcher('gpt-4o', ['gpt-4o'])).toBe(true);
    expect(matchesOmniMatcher('gpt-4o-2024-08-06', ['gpt-4o'])).toBe(true);
    expect(matchesOmniMatcher('gpt-3.5-turbo', ['gpt-4o'])).toBe(false);
  });

  it('treats an empty matcher list as "no filtering"', () => {
    expect(matchesOmniMatcher('anything', [])).toBe(true);
  });
});

describe('isUsableModel', () => {
  const model = (inputModalities: string[], supportsTools: boolean) => ({
    id: 'a',
    label: 'A',
    providerId: 'p',
    inputModalities: inputModalities as ('text' | 'image')[],
    supportsTools,
    verified: false,
  });

  it('requires text and image input', () => {
    expect(isUsableModel(model(['text'], true))).toBe(false);
    expect(isUsableModel(model(['text', 'image'], true))).toBe(true);
  });

  it('keeps omni models without tool calling (flagged in the UI instead)', () => {
    expect(isUsableModel(model(['text', 'image'], false))).toBe(true);
  });

  it('requires exactly the modalities the phases need', () => {
    expect(REQUIRED_INPUT_MODALITIES).toEqual(['text', 'image']);
  });
});

describe('fetchProviderModels', () => {
  it('keeps only multimodal models and reports published capabilities', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(openRouterPayload), { status: 200 }));

    const models = await fetchProviderModels(getProvider('openrouter')!, 'sk-or-v1-test');

    // Text-only models are dropped; tool-capable models come first.
    expect(models.map(model => model.id)).toEqual([
      'openai/gpt-4o-audio-preview',
      'openai/gpt-4o',
      'openai/o1',
    ]);
    expect(first(models).inputModalities).toEqual(['text', 'image', 'audio']);
    expect(first(models).supportsTools).toBe(true);
    // A model without tool calling is kept but pushed to the end.
    expect(models.at(-1)?.supportsTools).toBe(false);
    expect(models.every(model => model.verified)).toBe(true);
  });

  it('falls back to the curated matcher when the provider publishes nothing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 'meta/llama-3.2-90b-vision-instruct' },
            { id: 'meta/llama-3.1-70b-instruct' },
          ],
        }),
        { status: 200 }
      )
    );

    const models = await fetchProviderModels(getProvider('nvidia')!, 'nvapi-test');

    expect(models.map(model => model.id)).toEqual(['meta/llama-3.2-90b-vision-instruct']);
    expect(first(models).verified).toBe(false);
    expect(first(models).inputModalities).toEqual(['text', 'image']);
  });

  it('explains a rejected key', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(fetchProviderModels(getProvider('openrouter')!, 'bad')).rejects.toThrow(/refusée/);
  });

  it('explains a failed listing', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 500 }));

    await expect(fetchProviderModels(getProvider('openrouter')!, 'key')).rejects.toThrow(
      /Impossible de lister/
    );
  });

  it('rejects a provider without a models endpoint', async () => {
    const provider = { ...FALLBACK_PROVIDER, modelsPath: undefined };
    await expect(fetchProviderModels(provider, 'key')).rejects.toThrow(/n'expose pas/);
  });
});

describe('describeCapabilities', () => {
  it('renders modalities, tools and the verification caveat', () => {
    const model: AiModel = {
      id: 'm',
      label: 'M',
      providerId: 'openrouter',
      inputModalities: ['text', 'image', 'audio'],
      supportsTools: true,
      verified: false,
    };

    expect(describeCapabilities(model)).toContain('texte · image · audio');
    expect(describeCapabilities(model)).toContain('tool calling');
    expect(describeCapabilities(model)).toContain('capacités non publiées');
  });
});

describe('buildProviderTarget', () => {
  const request = {
    model: 'gpt-4o',
    messages: [
      { role: 'system' as const, content: 'Systeme' },
      { role: 'user' as const, content: 'Question' },
    ],
    temperature: 0.2,
    topP: 0.95,
    maxTokens: 4096,
  };

  /** Anthropic provider reference (kept local to avoid name shadowing). */
  const anthropicProvider = getProvider('anthropic')!;

  it('builds an OpenAI-compatible request for OpenRouter', () => {
    const target = buildProviderTarget(getProvider('openrouter')!, 'sk-or-v1-key', request);

    expect(target.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(target.dialect).toBe('openai');
    expect(target.headers.Authorization).toBe('Bearer sk-or-v1-key');
    expect(target.body).toMatchObject({
      model: 'gpt-4o',
      temperature: 0.2,
      top_p: 0.95,
      max_tokens: 4096,
    });
  });

  it('uses the NVIDIA endpoint for NVIDIA keys', () => {
    const target = buildProviderTarget(getProvider('nvidia')!, 'nvapi-key', request);
    expect(target.url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
  });

  it('moves the system prompt out and converts images for Anthropic', () => {
    const target = buildProviderTarget(anthropicProvider, 'sk-ant-key', {
      ...request,
      messages: [
        { role: 'system', content: 'Systeme' },
        { role: 'user', content: [CONTENT_PART] },
        { role: 'assistant', content: 'Reponse' },
      ],
    });

    expect(target.url).toBe('https://api.anthropic.com/v1/messages');
    expect(target.dialect).toBe('anthropic');
    expect(target.headers['x-api-key']).toBe('sk-ant-key');
    expect(target.headers['anthropic-version']).toBe('2023-06-01');
    expect(target.headers.Authorization).toBeUndefined();

    const body = target.body as {
      system: string;
      messages: Array<{ role: string; content: unknown }>;
    };
    expect(body.system).toBe('Systeme');
    expect(body.messages).toHaveLength(2);
    expect(first(body.messages).content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
    ]);
    expect(body.messages[1]?.role).toBe('assistant');
  });

  it('omits the system field for Anthropic when there is none', () => {
    const target = buildProviderTarget(anthropicProvider, 'sk-ant-key', {
      model: 'claude-sonnet-4',
      messages: [{ role: 'user', content: 'Question' }],
      temperature: 0.2,
      topP: 0.95,
      maxTokens: 4096,
    });
    expect(target.body).not.toHaveProperty('system');
  });

  it('passes response_format only in the OpenAI dialect', () => {
    const withFormat = { ...request, responseFormat: { type: 'json_object' as const } };

    const openAi = buildProviderTarget(getProvider('openai')!, 'sk-key', withFormat);
    expect((openAi.body as { response_format?: unknown }).response_format).toEqual({
      type: 'json_object',
    });

    const anthropic = buildProviderTarget(anthropicProvider, 'sk-ant-key', withFormat);
    expect(anthropic.body).not.toHaveProperty('response_format');
  });
});

describe('readCompletionText', () => {
  it('reads the OpenAI shape', () => {
    expect(readCompletionText({ choices: [{ message: { content: 'bonjour' } }] }, 'openai')).toBe(
      'bonjour'
    );
  });

  it('reads the Anthropic shape', () => {
    expect(readCompletionText({ content: [{ type: 'text', text: 'salut' }] }, 'anthropic')).toBe(
      'salut'
    );
  });

  it('returns null for an empty payload', () => {
    expect(readCompletionText({}, 'openai')).toBeNull();
    expect(readCompletionText({ content: [] }, 'anthropic')).toBeNull();
  });
});
