import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiServiceError,
  analyzeData,
  chatWithAssistant,
  generateBibliography,
  generateCadrage,
  generateJSON,
  generateLiteratureReview,
  generateText,
  improveTool,
  refineArchitecturePart,
  resolveApiBaseUrl,
  setSelectedModel,
} from '../api';
import { JsonParseError, parseJsonFromText } from '../json-parser';
import { first } from '../../test/helpers';
import { createNewProject } from '../projects';

/**
 * The AI layer is unit-tested against a mocked `fetch` so the network is never
 * touched: every wrapper is verified for its happy path, its error mapping and
 * its retry/parse behaviour.
 */

const okResponse = (content: unknown): Response =>
  new Response(JSON.stringify(content), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const completion = (text: string): unknown => ({
  choices: [{ message: { content: text } }],
});

const errorResponse = (status: number, message: string): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let fetchMock: ReturnType<typeof vi.fn>;

/** Body of the n-th request sent through the mocked fetch. */
function requestBody(callIndex: number): {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  response_format?: { type: string };
} {
  const init = (fetchMock.mock.calls[callIndex] as [string, RequestInit] | undefined)?.[1];
  if (typeof init?.body !== 'string')
    throw new Error(`Corps de requête absent pour l'appel ${callIndex}`);
  return JSON.parse(init.body) as ReturnType<typeof requestBody>;
}

/** Text of the last user message sent to the model. */
function lastUserMessage(callIndex = 0): string {
  return requestBody(callIndex).messages.at(-1)?.content ?? '';
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolveApiBaseUrl', () => {
  it('returns a relative path so any reverse proxy works', () => {
    expect(resolveApiBaseUrl()).toBe('/api/nvidia');
  });
});

describe('generateText', () => {
  it('posts to the proxy and returns the assistant content', async () => {
    fetchMock.mockResolvedValue(okResponse(completion('bonjour')));

    const result = await generateText('question', 'system prompt');

    expect(result).toBe('bonjour');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = requestBody(0);

    expect(url).toContain('/api/nvidia/chat/completions');
    expect(first(body.messages)).toEqual({ role: 'system', content: 'system prompt' });
    expect(body.messages[1]?.content).toBe('question');
    expect(body.temperature).toBeCloseTo(0.6);
  });

  it('maps a 403 upstream error to the French message', async () => {
    fetchMock.mockResolvedValue(errorResponse(403, 'nope'));

    await expect(generateText('x')).rejects.toThrow(/Accès refusé \(403\)/);
  });

  it('maps a network failure to a connection message', async () => {
    // Network errors are retried (flaky mobile connections), so drive the
    // backoff with fake timers instead of sleeping for real.
    vi.useFakeTimers();
    try {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const promise = generateText('x');
      const assertion = expect(promise).rejects.toThrow(/Impossible de contacter les serveurs/);
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws when the model returns no content', async () => {
    fetchMock.mockResolvedValue(okResponse({ choices: [] }));

    await expect(generateText('x')).rejects.toThrow(/n'a pas renvoyé de réponse/);
  });
});

describe('generateJSON', () => {
  it('returns the parsed payload and enables the json_object format', async () => {
    fetchMock.mockResolvedValue(okResponse(completion('{"a":1}')));

    const result = await generateJSON<{ a: number }>('prompt', {
      type: 'OBJECT',
      properties: { a: { type: 'NUMBER' } },
    });

    expect(result).toEqual({ a: 1 });
    const body = requestBody(0);

    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.temperature).toBeCloseTo(0.2);
  });

  it('retries with a stricter instruction when the first answer is unparsable', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse(completion('pas du json')))
      .mockResolvedValueOnce(okResponse(completion('{"a":2}')));

    const result = await generateJSON<{ a: number }>('prompt', { type: 'OBJECT' });

    expect(result).toEqual({ a: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(lastUserMessage(1)).toContain('JSON valide');
  });

  it('gives up after three attempts and reports a clear error', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse(completion('nope'))));

    await expect(generateJSON('prompt', { type: 'OBJECT' })).rejects.toThrow(
      /après plusieurs tentatives/
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('propagates an auth error instead of retrying', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 'unauthorized'));

    await expect(generateJSON('prompt', { type: 'OBJECT' })).rejects.toThrow(/authentification/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('business wrappers', () => {
  it('generateCadrage validates every required field', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        completion(
          '{"hypotheses":["H1"],"questions":["Q1"],"objectives":{"general":"G","specific":["S1"]}}'
        )
      )
    );

    const result = await generateCadrage('sujet', 'cycle', 'contexte');
    expect(result).toEqual({
      hypotheses: ['H1'],
      questions: ['Q1'],
      objectives: { general: 'G', specific: ['S1'] },
    });
  });

  it('generateCadrage rejects a payload missing options', async () => {
    fetchMock.mockResolvedValue(okResponse(completion('{"hypotheses":["H1"],"questions":["Q1"]}')));

    await expect(generateCadrage('sujet', 'cycle', 'contexte')).rejects.toThrow(AiServiceError);
  });

  it('generateLiteratureReview normalises the four sections', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        completion('{"keywords":["k"],"theories":["t"],"authors":["a"],"summary":"résumé"}')
      )
    );

    await expect(generateLiteratureReview('k', 'ctx')).resolves.toEqual({
      keywords: ['k'],
      theories: ['t'],
      authors: ['a'],
      summary: 'résumé',
    });
  });

  it('refineArchitecturePart returns a string list for hypotheses', async () => {
    fetchMock.mockResolvedValue(okResponse(completion('["H1","H2"]')));

    const project = { ...createNewProject(), hypotheses: ['old'] };
    await expect(refineArchitecturePart(project, 'hypotheses', 'instructions')).resolves.toEqual([
      'H1',
      'H2',
    ]);
  });

  it('refineArchitecturePart returns objectives as an object', async () => {
    fetchMock.mockResolvedValue(okResponse(completion('{"general":"G","specific":["S1"]}')));

    const project = { ...createNewProject(), hypotheses: ['old'] };
    await expect(refineArchitecturePart(project, 'objectives', 'instructions')).resolves.toEqual({
      general: 'G',
      specific: ['S1'],
    });
  });

  it('generateBibliography drops blank citations', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        completion('[{"id":"r1","citation":"Auteur (2020). Titre."},{"id":"r2","citation":"  "}]')
      )
    );

    const project = { ...createNewProject(), subject: 'sujet' };
    await expect(generateBibliography(project)).resolves.toEqual([
      { id: 'r1', citation: 'Auteur (2020). Titre.' },
    ]);
  });

  it('improveTool forwards the current content to the model', async () => {
    fetchMock.mockResolvedValue(okResponse(completion('nouvel outil')));

    const project = { ...createNewProject(), subject: 'sujet', hypotheses: ['H'] };
    const result = await improveTool(project, 'enseignants', 'ancien', 'instructions');

    expect(result).toBe('nouvel outil');
    expect(lastUserMessage()).toContain('ancien');
  });

  it('analyzeData rejects content-free chart entries and keeps usable ones', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        completion(
          '{"content":"analyse","charts":[{"title":"G","type":"bar","data":[{"name":"A","value":3}]},{"title":"Vide","type":"pie","data":[]}]}'
        )
      )
    );

    const project = { ...createNewProject(), subject: 'sujet', hypotheses: ['H'] };
    const result = await analyzeData(project, [], 'type', 'instructions');

    expect(result.content).toBe('analyse');
    expect(result.charts).toEqual([{ title: 'G', type: 'bar', data: [{ name: 'A', value: 3 }] }]);
  });

  it('chatWithAssistant includes the project context in the system prompt', async () => {
    fetchMock.mockResolvedValue(okResponse(completion('réponse')));

    const project = { ...createNewProject(), subject: 'mon sujet', hypotheses: ['H1'] };
    await chatWithAssistant(project, 'question', []);

    const body = requestBody(0);

    expect(first(body.messages).content).toContain('mon sujet');
    expect(body.messages.at(-1)?.content).toBe('question');
  });

  it('exports AiServiceError for status mapping', async () => {
    vi.useFakeTimers();
    try {
      // Fresh Response per call: a Response body can only be consumed once.
      fetchMock.mockImplementation(() => Promise.resolve(errorResponse(429, 'quota exceeded')));

      const promise = generateText('x');
      const assertion = expect(promise).rejects.toBeInstanceOf(AiServiceError);
      await vi.runAllTimersAsync();
      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(1 + 3); // initial + max retries
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('setSelectedModel', () => {
  it('persists the chosen model for subsequent calls', async () => {
    setSelectedModel('meta/llama-3.1-8b-instruct');
    fetchMock.mockResolvedValue(okResponse(completion('ok')));

    await generateText('x');

    expect(requestBody(0).model).toBe('meta/llama-3.1-8b-instruct');
  });
});

describe('parser integration', () => {
  it('JsonParseError carries the raw text for diagnostics', () => {
    try {
      parseJsonFromText('nope');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(JsonParseError);
      expect((error as JsonParseError).rawText).toBe('nope');
    }
  });
});
