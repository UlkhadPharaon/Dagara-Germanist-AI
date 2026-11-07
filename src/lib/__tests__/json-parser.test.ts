import { describe, expect, it } from 'vitest';
import {
  assertJsonShape,
  extractBalancedJson,
  JsonParseError,
  parseJsonFromText,
  stripCodeFences,
  unwrapSchemaEcho,
} from '../json-parser';

/**
 * Adversarial cases for the LLM response parser.
 *
 * Every case here corresponds to a failure mode observed in the previous
 * regex-based implementation, plus the truncation cases the audit flagged.
 */
describe('parseJsonFromText', () => {
  it('parses plain JSON', () => {
    expect(parseJsonFromText('{"a":1,"b":["x","y"]}')).toEqual({ a: 1, b: ['x', 'y'] });
  });

  it('parses JSON wrapped in a ```json fence with surrounding prose', () => {
    const raw = 'Voici le résultat demandé :\n```json\n{"a":1}\n```\nJ\'espère que cela aide.';
    expect(parseJsonFromText(raw)).toEqual({ a: 1 });
  });

  it('parses an unterminated fence (response hit the token ceiling)', () => {
    expect(parseJsonFromText('```json\n{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON preceded and followed by prose', () => {
    expect(parseJsonFromText('Bien sûr ! {"list":[1,2,3]} Voilà.')).toEqual({ list: [1, 2, 3] });
  });

  it('repairs unescaped double quotes inside string values', () => {
    const raw = '{"citation":"Selon l\'auteur, le "titre" est important","id":"x"}';
    expect(parseJsonFromText(raw)).toEqual({
      citation: 'Selon l\'auteur, le "titre" est important',
      id: 'x',
    });
  });

  it('repairs quotes that close object keys (followed by a colon)', () => {
    const raw = '{"key": "value", "other": "value"}';
    expect(parseJsonFromText(raw)).toEqual({ key: 'value', other: 'value' });
  });

  it('repairs trailing commas', () => {
    expect(parseJsonFromText('{"a":1,"b":[1,2,3,],}')).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it('keeps braces that live inside string values', () => {
    const raw = '{"pattern":"if (x) { y(); }","n":2}';
    expect(parseJsonFromText(raw)).toEqual({ pattern: 'if (x) { y(); }', n: 2 });
  });

  it('selects the first complete object when several are present', () => {
    expect(parseJsonFromText('{"first":true} texte {"second":true}')).toEqual({ first: true });
  });

  it('parses a JSON array root', () => {
    expect(parseJsonFromText('[{"id":"1"},{"id":"2"}]')).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('unwraps a schema echo', () => {
    const raw = '{"type":"OBJECT","properties":{"hypotheses":[]}}';
    expect(unwrapSchemaEcho(parseJsonFromText(raw))).toEqual({ hypotheses: [] });
  });

  it('throws on a truncated object instead of returning partial data', () => {
    expect(() => parseJsonFromText('{"a":1,"b":[1,2')).toThrow(JsonParseError);
  });

  it('throws on pure prose', () => {
    expect(() => parseJsonFromText('Je ne peux pas répondre à cette demande.')).toThrow(
      JsonParseError
    );
  });

  it('throws on an empty response', () => {
    expect(() => parseJsonFromText('')).toThrow(JsonParseError);
  });

  it('throws on a JSON array of only whitespace', () => {
    expect(() => parseJsonFromText('   \n  ')).toThrow(JsonParseError);
  });
});

describe('extractBalancedJson', () => {
  it('returns the balanced span', () => {
    expect(extractBalancedJson('prefix {"a":[1,{"b":2}]} suffix')).toBe('{"a":[1,{"b":2}]}');
  });

  it('returns null for a ragged payload', () => {
    expect(extractBalancedJson('{"a":[1,2')).toBeNull();
  });
});

describe('stripCodeFences', () => {
  it('removes a fenced block and keeps the payload', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('leaves plain JSON untouched', () => {
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe('assertJsonShape', () => {
  it('accepts a matching object', () => {
    const raw = '{"hypotheses":[],"questions":[],"objectives":{}}';
    expect(() =>
      assertJsonShape(
        parseJsonFromText(raw),
        {
          rootType: 'object',
          requiredKeys: ['hypotheses', 'questions', 'objectives'],
        },
        raw
      )
    ).not.toThrow();
  });

  it('rejects an object with missing keys', () => {
    const raw = '{"hypotheses":[]}';
    expect(() =>
      assertJsonShape(
        parseJsonFromText(raw),
        { rootType: 'object', requiredKeys: ['summary'] },
        raw
      )
    ).toThrow(JsonParseError);
  });

  it('rejects an array when an object was expected', () => {
    const raw = '[1,2,3]';
    expect(() => assertJsonShape(parseJsonFromText(raw), { rootType: 'object' }, raw)).toThrow(
      JsonParseError
    );
  });

  it('rejects an empty array', () => {
    const raw = '[]';
    expect(() => assertJsonShape(parseJsonFromText(raw), { rootType: 'array' }, raw)).toThrow(
      JsonParseError
    );
  });
});
