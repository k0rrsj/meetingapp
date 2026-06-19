/**
 * Tiny, dependency-free validation helpers used by the AI pipeline.
 *
 * A `Validator<T>` turns unknown parsed JSON into either a typed value or a
 * human-readable error string. Validators normalize as much as is safe so the
 * rest of the app always receives a well-shaped object (defined arrays, etc.),
 * which prevents `Cannot read properties of undefined` crashes downstream.
 */

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type Validator<T> = (value: unknown) => ValidationResult<T>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
