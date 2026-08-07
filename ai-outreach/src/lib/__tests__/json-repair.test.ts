import { describe, expect, it } from 'vitest';
import { extractJsonObject } from '../json-repair';

describe('extractJsonObject', () => {
  it('parses clean JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('unwraps fenced JSON', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('unwraps unlabelled fences', () => {
    expect(extractJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('ignores prose around the object', () => {
    expect(extractJsonObject('Here is the analysis:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });

  it('tolerates trailing commas', () => {
    expect(extractJsonObject('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] });
  });

  it('does not stop at braces inside strings', () => {
    expect(extractJsonObject('{"a":"a } brace","b":2}')).toEqual({ a: 'a } brace', b: 2 });
  });

  it('handles escaped quotes inside strings', () => {
    expect(extractJsonObject('prefix {"a":"say \\"hi\\" }","b":2} suffix')).toEqual({
      a: 'say "hi" }',
      b: 2,
    });
  });

  it('handles nested objects', () => {
    expect(extractJsonObject('noise {"a":{"b":{"c":3}}} noise')).toEqual({ a: { b: { c: 3 } } });
  });

  it('returns undefined when there is no object', () => {
    expect(extractJsonObject('no json here')).toBeUndefined();
    expect(extractJsonObject('')).toBeUndefined();
  });

  it('returns undefined for an unterminated object', () => {
    expect(extractJsonObject('{"a":1')).toBeUndefined();
  });
});
