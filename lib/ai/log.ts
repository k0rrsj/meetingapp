/**
 * Minimal, privacy-aware diagnostics for the AI pipeline.
 *
 * Goals (see Iteration 0 brief, section H):
 *  - know on which step / endpoint / action something failed;
 *  - know the error kind (parse / validation / empty / network / api);
 *  - know whether a raw AI response was present;
 *  - know which meeting / manager / provider was involved (safe ids only).
 *
 * Never logged: API keys, access tokens, passwords, or any secret material.
 * Raw AI output can contain personal data, so by default we only log a short
 * preview. Set AI_DEBUG_RAW=1 to log the full raw response for deep debugging.
 */

export type AiErrorKind = 'empty' | 'parse' | 'validation' | 'network' | 'api' | 'unknown';

export interface AiLogContext {
  /** Logical action, e.g. 'analyze-transcription'. */
  action: string;
  endpoint?: string;
  meetingId?: string;
  managerId?: string;
  model?: string;
  provider?: string;
}

const RAW_PREVIEW_LIMIT = 600;

function rawPreview(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const text = String(raw);
  if (process.env.AI_DEBUG_RAW === '1') return text;
  const trimmed = text.trim();
  if (trimmed.length <= RAW_PREVIEW_LIMIT) return trimmed;
  return `${trimmed.slice(0, RAW_PREVIEW_LIMIT)}…[+${trimmed.length - RAW_PREVIEW_LIMIT} chars]`;
}

/** Strip anything that might look like a secret before it reaches the logs. */
function safeDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  return detail
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, 'sk-***')
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi, '$1=***')
    .slice(0, 500);
}

export function logAiError(
  context: AiLogContext,
  kind: AiErrorKind,
  options: { raw?: string | null; detail?: string } = {}
): void {
  const payload = {
    scope: 'ai',
    level: 'error',
    kind,
    action: context.action,
    endpoint: context.endpoint,
    meetingId: context.meetingId,
    managerId: context.managerId,
    model: context.model,
    provider: context.provider ?? 'anthropic',
    rawPresent: options.raw != null && String(options.raw).trim() !== '',
    rawPreview: rawPreview(options.raw),
    detail: safeDetail(options.detail),
    at: new Date().toISOString(),
  };
  // Single structured line — easy to grep in Vercel / server logs.
  console.error('[ai]', JSON.stringify(payload));
}
