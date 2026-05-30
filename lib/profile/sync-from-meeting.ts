import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Keeps the "living" leader profile (left column on the manager page) in sync
 * with the outcomes of closed meetings.
 *
 * Design choices (intentionally lightweight — see iteration brief):
 *  - NO extra AI/OpenRouter call. The source fields (strengths / weaknesses /
 *    conclusions / problems) are already produced by the transcription analysis,
 *    so closing a meeting stays fast and never adds a second point of AI failure.
 *  - NO manual accept/reject step. Updates are applied directly and made
 *    transparent through `leader_profile_changes` (the changelog).
 *  - Idempotent per meeting id, so re-closing / retries don't duplicate entries.
 */

const AUTO_CONTEXT_HEADER = 'Контекст из встреч (обновляется автоматически)';
const AUTO_CONTEXT_MARKER = `— ${AUTO_CONTEXT_HEADER} —`;
const MAX_AUTO_MEETINGS = 3;
const CONCLUSION_TRIM = 280;

export type ProfileSyncResult =
  | { ok: true; updated: boolean; skipped?: boolean; skip_reason?: 'already_synced' | 'no_input'; changes: string[] }
  | { ok: false; code: 'MEETING_NOT_FOUND' | 'SAVE'; message: string };

interface ClosedMeetingRow {
  id: string;
  meeting_number: number;
  date: string | null;
  conducted_at: string | null;
  conclusions: string | null;
  key_facts: string | null;
}

function trimText(value: string | null | undefined, max: number): string {
  if (!value) return '';
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max).trimEnd()}…`;
}

/** Splits the existing context into the manually-written base and drops the managed auto block. */
function extractManualBase(context: string | null): string {
  if (!context) return '';
  const idx = context.indexOf(AUTO_CONTEXT_MARKER);
  if (idx === -1) return context.trimEnd();
  return context.slice(0, idx).trimEnd();
}

/** Rebuilds the managed "from meetings" block from the most recent closed meetings. */
function buildContext(base: string, closedMeetings: ClosedMeetingRow[]): string {
  const lines = closedMeetings
    .map((m) => {
      const summary = trimText(m.conclusions ?? m.key_facts, CONCLUSION_TRIM);
      if (!summary) return null;
      const datePart = m.date ? ` (${m.date})` : '';
      return `• Встреча №${m.meeting_number}${datePart}: ${summary}`;
    })
    .filter((line): line is string => Boolean(line));

  if (lines.length === 0) return base.trim();

  const autoBlock = `${AUTO_CONTEXT_MARKER}\n${lines.join('\n')}`;
  return base ? `${base}\n\n${autoBlock}` : autoBlock;
}

export async function syncLeaderProfileFromMeeting(
  supabase: SupabaseClient,
  params: { meetingId: string; respectIdempotency?: boolean }
): Promise<ProfileSyncResult> {
  const respectIdempotency = params.respectIdempotency !== false;

  const { data: meeting, error: mErr } = await supabase
    .from('meetings')
    .select('id, manager_id, meeting_number, strengths, weaknesses, conclusions, key_facts, problems_signals, manager:managers(id, context, strengths, weaknesses)')
    .eq('id', params.meetingId)
    .single();

  if (mErr || !meeting) {
    return { ok: false, code: 'MEETING_NOT_FOUND', message: 'Встреча не найдена' };
  }

  const manager = (Array.isArray(meeting.manager) ? meeting.manager[0] : meeting.manager) as {
    id: string;
    context: string | null;
    strengths: string | null;
    weaknesses: string | null;
  } | null;

  if (!manager) {
    return { ok: false, code: 'MEETING_NOT_FOUND', message: 'Руководитель не найден' };
  }

  // Idempotency — skip if we already logged AI changes for this meeting.
  if (respectIdempotency) {
    const { data: existing } = await supabase
      .from('leader_profile_changes')
      .select('id')
      .eq('manager_id', meeting.manager_id)
      .eq('meeting_id', meeting.id)
      .eq('changed_by', 'ai')
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: true, updated: false, skipped: true, skip_reason: 'already_synced', changes: [] };
    }
  }

  const updates: Record<string, unknown> = {};
  const changes: string[] = [];

  // Strengths / weaknesses — refreshed from the latest meeting analysis.
  const newStrengths = meeting.strengths?.trim();
  if (newStrengths && newStrengths !== (manager.strengths ?? '').trim()) {
    updates.strengths = newStrengths;
    changes.push('Уточнены сильные стороны');
  }

  const newWeaknesses = meeting.weaknesses?.trim();
  if (newWeaknesses && newWeaknesses !== (manager.weaknesses ?? '').trim()) {
    updates.weaknesses = newWeaknesses;
    changes.push('Уточнены слабые стороны и зоны роста');
  }

  // Context — managed rolling block built from the last few closed meetings.
  const { data: closedMeetings } = await supabase
    .from('meetings')
    .select('id, meeting_number, date, conducted_at, conclusions, key_facts')
    .eq('manager_id', meeting.manager_id)
    .eq('status', 'closed')
    .order('meeting_number', { ascending: false })
    .limit(MAX_AUTO_MEETINGS);

  const base = extractManualBase(manager.context);
  const nextContext = buildContext(base, (closedMeetings ?? []) as ClosedMeetingRow[]);
  if (nextContext.trim() !== (manager.context ?? '').trim()) {
    updates.context = nextContext;
    changes.push(`Обновлён контекст по итогам встречи №${meeting.meeting_number}`);
  }

  // Risks / signals — surfaced for transparency (the problems tracker itself is
  // updated during analysis via problems_delta).
  if (meeting.problems_signals?.trim()) {
    changes.push('Зафиксированы риски и сигналы встречи');
  }

  if (changes.length === 0) {
    return { ok: true, updated: false, skipped: true, skip_reason: 'no_input', changes: [] };
  }

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabase
      .from('managers')
      .update(updates)
      .eq('id', meeting.manager_id);
    if (updErr) {
      return { ok: false, code: 'SAVE', message: updErr.message };
    }
  }

  // Best-effort changelog write. If the table is missing (migration not applied
  // yet) we still succeed — the profile is updated and the UI shows the fallback.
  try {
    await supabase.from('leader_profile_changes').insert(
      changes.map((summary) => ({
        manager_id: meeting.manager_id,
        meeting_id: meeting.id,
        changed_by: 'ai',
        summary,
      }))
    );
  } catch {
    // ignore — changelog is non-critical
  }

  return { ok: true, updated: true, changes };
}
