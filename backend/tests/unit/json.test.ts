import { cleanJsonMarkdown } from '../../src/utils/json.js';

describe('cleanJsonMarkdown helper tests', () => {
  it('should return a plain JSON string untouched', () => {
    const json = '{"response": "hello", "confirmed": true}';
    expect(cleanJsonMarkdown(json)).toBe(json);
  });

  it('should clean JSON wrapped in ```json and ```', () => {
    const wrapped = '```json\n{"response": "hello", "confirmed": true}\n```';
    expect(cleanJsonMarkdown(wrapped)).toBe('{"response": "hello", "confirmed": true}');
  });

  it('should clean JSON wrapped in ``` and ``` (no language specifier)', () => {
    const wrapped = '```\n{"response": "hello", "confirmed": true}\n```';
    expect(cleanJsonMarkdown(wrapped)).toBe('{"response": "hello", "confirmed": true}');
  });

  it('should trim surrounding whitespaces and newlines', () => {
    const wrapped = '  \n  ```json\n{\n  "response": "hello"\n}\n```  \n  ';
    expect(cleanJsonMarkdown(wrapped)).toBe('{\n  "response": "hello"\n}');
  });

  it('should clean single-line backticks code block', () => {
    const wrapped = '```json{"response": "hello"}```';
    expect(cleanJsonMarkdown(wrapped)).toBe('{"response": "hello"}');
  });
});
