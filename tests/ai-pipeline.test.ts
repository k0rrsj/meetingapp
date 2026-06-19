import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractJson } from '@/lib/ai/extract-json';
import { safeParseAiJson, AI_USER_MESSAGES } from '@/lib/ai/safe-parse';
import {
  validateMeetingAnalysis,
  validateTrackUpdateAnalysis,
  validatePeopleCandidates,
  validateDynamicsSnapshot,
} from '@/lib/ai/schemas';

const ctx = { action: 'test', endpoint: '/test' };

// AI output is logged on failure — silence it so test output stays readable.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const TECHNICAL_LEAKS = [
  'Unexpected token',
  'JSON.parse',
  'Cannot read properties',
  'undefined',
  'SyntaxError',
];

function assertNoTechnicalLeak(message: string) {
  for (const leak of TECHNICAL_LEAKS) {
    expect(message.toLowerCase()).not.toContain(leak.toLowerCase());
  }
}

describe('extractJson', () => {
  it('parses clean JSON object', () => {
    const r = extractJson('{"a":1}');
    expect(r).toEqual({ ok: true, value: { a: 1 } });
  });

  it('parses JSON inside a markdown code block', () => {
    const r = extractJson('```json\n{"a":1}\n```');
    expect(r.ok && r.value).toEqual({ a: 1 });
  });

  it('parses JSON embedded in surrounding prose', () => {
    const r = extractJson('Вот результат: {"a":1} — готово.');
    expect(r.ok && r.value).toEqual({ a: 1 });
  });

  it('parses a fenced block surrounded by text', () => {
    const r = extractJson('Готово.\n```\n{"a":2}\n```\nКонец.');
    expect(r.ok && r.value).toEqual({ a: 2 });
  });

  it('parses double-encoded JSON', () => {
    const r = extractJson(JSON.stringify(JSON.stringify({ a: 3 })));
    expect(r.ok && r.value).toEqual({ a: 3 });
  });

  it('parses JSON arrays', () => {
    const r = extractJson('[{"name":"X"}]');
    expect(r.ok && r.value).toEqual([{ name: 'X' }]);
  });

  it('fails gracefully on garbage', () => {
    expect(extractJson('это не json вообще').ok).toBe(false);
    expect(extractJson('').ok).toBe(false);
    expect(extractJson(null).ok).toBe(false);
    expect(extractJson(undefined).ok).toBe(false);
  });
});

describe('safeParseAiJson — meeting analysis', () => {
  it('returns typed data for a valid response', () => {
    const raw = JSON.stringify({ conclusions: 'Вывод', action_plan: 'План' });
    const r = safeParseAiJson({ raw, validate: validateMeetingAnalysis, context: ctx });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.fields.conclusions).toBe('Вывод');
      expect(r.data.problems_delta).toEqual([]);
    }
  });

  it('extracts JSON from a fenced block', () => {
    const raw = '```json\n{"key_facts":"Факт"}\n```';
    const r = safeParseAiJson({ raw, validate: validateMeetingAnalysis, context: ctx });
    expect(r.ok && r.data.fields.key_facts).toBe('Факт');
  });

  it('returns a friendly message on invalid JSON (never technical)', () => {
    const r = safeParseAiJson({ raw: 'не json {{{', validate: validateMeetingAnalysis, context: ctx });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('parse');
      expect(r.message).toBe(AI_USER_MESSAGES.format);
      assertNoTechnicalLeak(r.message);
    }
  });

  it('returns a friendly message on empty response', () => {
    const r = safeParseAiJson({ raw: '   ', validate: validateMeetingAnalysis, context: ctx });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('empty');
      assertNoTechnicalLeak(r.message);
    }
  });

  it('fails validation (friendly) when JSON parses but has no usable fields', () => {
    const r = safeParseAiJson({ raw: '{"unrelated":true}', validate: validateMeetingAnalysis, context: ctx });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('validation');
      assertNoTechnicalLeak(r.message);
    }
  });

  it('keeps only valid problems_delta items', () => {
    const raw = JSON.stringify({
      conclusions: 'c',
      problems_delta: [
        { action: 'new', text: 'Проблема' },
        { action: 'new', text: '' },
        { action: 'ongoing', problem_id: 'p1' },
        { action: 'bogus' },
      ],
    });
    const r = safeParseAiJson({ raw, validate: validateMeetingAnalysis, context: ctx });
    expect(r.ok && r.data.problems_delta).toEqual([
      { action: 'new', text: 'Проблема' },
      { action: 'ongoing', problem_id: 'p1', resolution_note: undefined },
    ]);
  });
});

describe('validateTrackUpdateAnalysis — crash-proof normalization', () => {
  it('fills missing arrays with [] so the UI cannot crash', () => {
    const r = validateTrackUpdateAnalysis({ summary: 'Итог' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.additions).toEqual([]);
      expect(r.data.new_action_items).toEqual([]);
      expect(r.data.mentioned_people).toEqual([]);
      expect(r.data.summary).toBe('Итог');
    }
  });

  it('normalizes nested items and drops malformed ones', () => {
    const r = validateTrackUpdateAnalysis({
      summary: 's',
      additions: [{ section: 'A', content: 'B' }, 'broken', { foo: 1 }],
      new_action_items: [{ what: 'do', deadline: 'tomorrow', report_format: 'text' }, { what: '' }],
      mentioned_people: [{ name: 'Ivan', is_new: true, delta: 'd' }, { delta: 'x' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.additions).toHaveLength(1);
      expect(r.data.new_action_items).toHaveLength(1);
      expect(r.data.mentioned_people).toEqual([{ name: 'Ivan', is_new: true, delta: 'd' }]);
    }
  });

  it('rejects a totally empty analysis', () => {
    expect(validateTrackUpdateAnalysis({}).ok).toBe(false);
    expect(validateTrackUpdateAnalysis('not an object').ok).toBe(false);
  });
});

describe('validatePeopleCandidates', () => {
  it('filters out entries without a name', () => {
    const r = validatePeopleCandidates([{ name: 'Анна', position: 'CFO' }, { position: 'x' }, 'junk']);
    expect(r.ok && r.data).toEqual([{ name: 'Анна', position: 'CFO', context: undefined }]);
  });

  it('rejects non-arrays', () => {
    expect(validatePeopleCandidates({}).ok).toBe(false);
  });
});

describe('validateDynamicsSnapshot', () => {
  it('always returns defined arrays and numeric summary', () => {
    const r = validateDynamicsSnapshot({ installations: [{ thesis: 't' }], summary: { promised: '2', bad: 'x' } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.installations).toHaveLength(1);
      expect(r.data.patterns).toEqual([]);
      expect(r.data.commitments).toEqual([]);
      expect(r.data.summary).toEqual({ promised: 2 });
    }
  });
});
