import type { SupabaseClient } from '@supabase/supabase-js';
import { callOpenRouter } from '@/lib/openrouter/client';
import { buildTrackSyncPrompt, truncateTrackForPrompt } from '@/lib/prompts/track-sync';
import { parseAiUpdates, saveDocumentWithVersion } from './ai-updates';
import { isStructuredTrackContent } from './section-ids';
import {
  mergeTrackSectionUpdates,
  trackHasSyncedMeetingMarker,
  validateTrackMarkersIntact,
} from './merge-sections';
import { ensureCanonicalTrackDocument } from './ensure-canonical';

export type TrackSyncResult =
  | { ok: true; document_id: string; skipped: boolean; skip_reason?: 'already_synced' | 'no_input' }
  | {
      ok: false;
      code:
        | 'MEETING_NOT_FOUND'
        | 'NOT_STRUCTURED'
        | 'AI_CALL'
        | 'AI_PARSE'
        | 'MERGE'
        | 'VALIDATION'
        | 'SAVE';
      message: string;
    };

/**
 * Merges structured meeting outputs into the manager's canonical v1 track document.
 * Idempotent per meeting id via `<!-- synced:meetingId -->` in chronology section.
 */
export async function syncTrackFromMeeting(
  supabase: SupabaseClient,
  params: {
    meetingId: string;
    actingUserId: string;
    /** Override model from ai_settings */
    model?: string;
    /** When false, skip if already synced (default true) */
    respectIdempotency?: boolean;
  }
): Promise<TrackSyncResult> {
  const respectIdempotency = params.respectIdempotency !== false;

  const { data: meeting, error: mErr } = await supabase
    .from('meetings')
    .select('*, manager:managers(*)')
    .eq('id', params.meetingId)
    .single();

  if (mErr || !meeting) {
    return { ok: false, code: 'MEETING_NOT_FOUND', message: 'Встреча не найдена' };
  }

  const manager = meeting.manager as {
    id: string;
    name: string;
    position: string | null;
    company_id: string;
  };

  const { data: companyRow } = await supabase
    .from('companies')
    .select('name')
    .eq('id', manager.company_id)
    .maybeSingle();

  const companyName = companyRow?.name ?? '—';

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('id', params.actingUserId)
    .single();

  const consultantName = profile?.name?.trim() || '—';

  const { data: aiSettings } = await supabase
    .from('ai_settings')
    .select('preferred_model')
    .eq('user_id', params.actingUserId)
    .maybeSingle();

  const model = params.model ?? aiSettings?.preferred_model ?? 'anthropic/claude-opus-4-5';

  const { document: trackDoc } = await ensureCanonicalTrackDocument(supabase, {
    managerId: manager.id,
    managerName: manager.name,
    position: manager.position,
    companyName,
    consultantName,
    actingUserId: params.actingUserId,
  });

  if (!isStructuredTrackContent(trackDoc.content)) {
    return {
      ok: false,
      code: 'NOT_STRUCTURED',
      message:
        'Текущий документ трека не в формате v1. Откройте вкладку «Трек» и нажмите «Установить шаблон v1».',
    };
  }

  if (respectIdempotency && trackHasSyncedMeetingMarker(trackDoc.content, params.meetingId)) {
    return {
      ok: true,
      document_id: trackDoc.id,
      skipped: true,
      skip_reason: 'already_synced',
    };
  }

  const hasText =
    (meeting.transcription_text?.trim()?.length ?? 0) > 0 ||
    (meeting.key_facts?.trim()?.length ?? 0) > 0 ||
    (meeting.conclusions?.trim()?.length ?? 0) > 0;

  if (!hasText) {
    return {
      ok: true,
      document_id: trackDoc.id,
      skipped: true,
      skip_reason: 'no_input',
    };
  }

  const meetingDate =
    meeting.date ??
    (meeting.conducted_at ? String(meeting.conducted_at).slice(0, 10) : new Date().toISOString().slice(0, 10));

  const prompt = buildTrackSyncPrompt({
    managerName: manager.name,
    meetingDate,
    meetingNumber: meeting.meeting_number,
    transcriptionText: meeting.transcription_text,
    keyFacts: meeting.key_facts,
    problemsSignals: meeting.problems_signals,
    conclusions: meeting.conclusions,
    strengths: meeting.strengths,
    weaknesses: meeting.weaknesses,
    actionPlan: meeting.action_plan,
    trackExcerpt: truncateTrackForPrompt(trackDoc.content, 14_000),
  });

  let raw: string;
  try {
    raw = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: 6000,
      temperature: 0.35,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка AI';
    return { ok: false, code: 'AI_CALL', message };
  }

  const parsed = parseAiUpdates(raw);
  if (!parsed || parsed.updates.length === 0) {
    return { ok: false, code: 'AI_PARSE', message: 'Модель не вернула применимых обновлений (JSON)' };
  }

  const merged = mergeTrackSectionUpdates(trackDoc.content, parsed.updates, {
    meetingId: params.meetingId,
    appendSyncMarkerToSection: 'chronology',
  });

  if (!merged.ok) {
    return { ok: false, code: 'MERGE', message: merged.error };
  }

  if (!validateTrackMarkersIntact(merged.content)) {
    return { ok: false, code: 'VALIDATION', message: 'После слияния нарушена структура маркеров трека' };
  }

  try {
    await saveDocumentWithVersion(supabase, trackDoc.id, merged.content, params.actingUserId);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка сохранения';
    return { ok: false, code: 'SAVE', message };
  }

  return { ok: true, document_id: trackDoc.id, skipped: false };
}
