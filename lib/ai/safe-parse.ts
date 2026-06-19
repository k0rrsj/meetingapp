/**
 * The single safe entry point for turning a raw AI response into validated data.
 *
 *   raw model output → extract JSON → validate via schema → typed data
 *
 * On any failure it:
 *  - never throws (returns a discriminated result instead);
 *  - logs a privacy-aware diagnostic line (incl. raw preview for debugging);
 *  - returns a clear, non-technical Russian message for the user.
 *
 * The user never sees "Unexpected token", "JSON.parse failed" or
 * "Cannot read properties of undefined".
 */

import { extractJson } from './extract-json';
import { logAiError, type AiLogContext } from './log';
import type { Validator } from './validate';

export type SafeParseReason = 'empty' | 'parse' | 'validation';

export type SafeParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: SafeParseReason; message: string };

export const AI_USER_MESSAGES = {
  empty:
    'AI вернул пустой ответ. Данные сохранены — попробуйте повторить действие.',
  format:
    'AI вернул ответ в неверном формате. Данные встречи сохранены, попробуйте повторить анализ.',
  generic:
    'Не удалось обработать ответ AI. Попробуйте повторить действие или сохраните встречу без анализа.',
} as const;

export interface SafeParseOptions<T> {
  raw: string | null | undefined;
  validate: Validator<T>;
  context: AiLogContext;
  /** Override the user-facing message used for parse/validation failures. */
  formatMessage?: string;
  /** Override the user-facing message used for empty responses. */
  emptyMessage?: string;
}

export function safeParseAiJson<T>(options: SafeParseOptions<T>): SafeParseResult<T> {
  const { raw, validate, context } = options;
  const formatMessage = options.formatMessage ?? AI_USER_MESSAGES.format;
  const emptyMessage = options.emptyMessage ?? AI_USER_MESSAGES.empty;

  if (raw == null || String(raw).trim() === '') {
    logAiError(context, 'empty', { raw });
    return { ok: false, reason: 'empty', message: emptyMessage };
  }

  const extracted = extractJson(raw);
  if (!extracted.ok) {
    logAiError(context, 'parse', { raw });
    return { ok: false, reason: 'parse', message: formatMessage };
  }

  const validated = validate(extracted.value);
  if (!validated.ok) {
    logAiError(context, 'validation', { raw, detail: validated.error });
    return { ok: false, reason: 'validation', message: formatMessage };
  }

  return { ok: true, data: validated.data };
}
