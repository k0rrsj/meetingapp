/**
 * Robust JSON extraction from raw model output.
 *
 * Handles, in order of preference:
 *  - clean JSON;
 *  - JSON wrapped in a ```json fenced code block (with surrounding prose);
 *  - JSON embedded inside free text (object or array slice);
 *  - double-encoded JSON (a JSON string that itself contains JSON).
 *
 * Returns a discriminated result so callers never deal with thrown
 * SyntaxErrors from JSON.parse.
 */

export type ExtractJsonResult =
  | { ok: true; value: unknown }
  | { ok: false };

function tryParse(text: string): ExtractJsonResult {
  try {
    let value: unknown = JSON.parse(text);
    // Some models double-encode: JSON.parse yields a string that is itself JSON.
    if (typeof value === 'string') {
      const inner = value.trim();
      if (inner.startsWith('{') || inner.startsWith('[')) {
        try {
          value = JSON.parse(inner);
        } catch {
          /* keep the string value */
        }
      }
    }
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

export function extractJson(raw: string | null | undefined): ExtractJsonResult {
  if (raw == null) return { ok: false };
  const trimmed = String(raw).trim();
  if (!trimmed) return { ok: false };

  const candidates: string[] = [trimmed];

  // Fenced code block: ```json ... ``` or ``` ... ```
  const fence = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence?.[1]) candidates.push(fence[1].trim());

  // Unbalanced / leading-trailing fence markers.
  const stripped = trimmed
    .replace(/^```(?:json|JSON)?\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
  if (stripped && stripped !== trimmed) candidates.push(stripped);

  // First object / array slice found in the text.
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (objMatch) candidates.push(objMatch[0]);
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrMatch) candidates.push(arrMatch[0]);

  for (const candidate of candidates) {
    if (!candidate) continue;
    const result = tryParse(candidate);
    if (result.ok) return result;
  }

  return { ok: false };
}
