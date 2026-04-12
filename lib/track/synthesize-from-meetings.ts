import type { SupabaseClient } from '@supabase/supabase-js';
import { callOpenRouter } from '@/lib/openrouter/client';
import { buildTrackSynthesizeFromHistoryPrompt } from '@/lib/prompts/track-sync';
import { parseAiUpdates, saveDocumentWithVersion } from './ai-updates';
import { isStructuredTrackContent } from './section-ids';
import { mergeTrackSectionUpdates, validateTrackMarkersIntact } from './merge-sections';
import { ensureCanonicalTrackDocument } from './ensure-canonical';

export type SynthesizeTrackResult =
  | { ok: true; document_id: string }
  | {
      ok: false;
      code: 'NOT_STRUCTURED' | 'NO_MEETINGS' | 'AI_CALL' | 'AI_PARSE' | 'MERGE' | 'VALIDATION' | 'SAVE';
      message: string;
    };

const ARCHIVE_BUDGET_CHARS = 72_000;
const TX_MAX = 6000;
const FIELD_MAX = 2000;

function clip(s: string | null | undefined, max: number): string {
  const t = (s ?? '').trim();
  if (!t) return '(нет)';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[…обрезано…]`;
}

function meetingHasUsableContent(m: {
  transcription_text?: string | null;
  key_facts?: string | null;
  conclusions?: string | null;
  problems_signals?: string | null;
  strengths?: string | null;
  weaknesses?: string | null;
  action_plan?: string | null;
}): boolean {
  return (
    (m.transcription_text?.trim().length ?? 0) > 0 ||
    (m.key_facts?.trim().length ?? 0) > 0 ||
    (m.conclusions?.trim().length ?? 0) > 0 ||
    (m.problems_signals?.trim().length ?? 0) > 0 ||
    (m.strengths?.trim().length ?? 0) > 0 ||
    (m.weaknesses?.trim().length ?? 0) > 0 ||
    (m.action_plan?.trim().length ?? 0) > 0
  );
}

type MeetingArchiveRow = {
  meeting_number: number;
  date: string | null;
  status: string;
  transcription_text: string | null;
  key_facts: string | null;
  problems_signals: string | null;
  conclusions: string | null;
  strengths: string | null;
  weaknesses: string | null;
  action_plan: string | null;
  next_scenario: string | null;
};

function formatMeetingBlock(m: MeetingArchiveRow): string {
  return `## Встреча №${m.meeting_number} от ${m.date ?? '—'} (${m.status})

### Расшифровка
${clip(m.transcription_text, TX_MAX)}

### Ключевые факты
${clip(m.key_facts, FIELD_MAX)}

### Проблемы и сигналы
${clip(m.problems_signals, FIELD_MAX)}

### Выводы
${clip(m.conclusions, FIELD_MAX)}

### Сильные стороны
${clip(m.strengths, FIELD_MAX)}

### Зоны роста
${clip(m.weaknesses, FIELD_MAX)}

### План действий
${clip(m.action_plan, FIELD_MAX)}

### Сценарий следующей встречи
${clip(m.next_scenario, FIELD_MAX)}`;
}

function buildMeetingsArchive(meetings: MeetingArchiveRow[]): string {
  const parts: string[] = [];
  let total = 0;
  const skipped: number[] = [];

  for (const m of meetings) {
    const block = formatMeetingBlock(m);
    const sep = parts.length ? '\n\n---\n\n' : '';
    if (total + sep.length + block.length > ARCHIVE_BUDGET_CHARS) {
      skipped.push(m.meeting_number);
      continue;
    }
    parts.push(block);
    total += sep.length + block.length;
  }

  let out = parts.join('\n\n---\n\n');
  if (skipped.length) {
    out += `\n\n_(В архив не вошли встречи (лимит объёма для модели): № ${skipped.join(', ')} — при необходимости запустите синтез снова после сжатия расшифровок или обработайте вручную.)_`;
  }
  return out || '(Нет текстовых материалов по встречам)';
}

function buildManagerProfileBlock(m: {
  position: string | null;
  role_in_team: string | null;
  context: string | null;
  director_request: string | null;
  strengths: string | null;
  weaknesses: string | null;
  consultant_comments: string | null;
}): string {
  return [
    m.position ? `**Должность:** ${m.position}` : null,
    m.role_in_team ? `**Роль в команде:** ${m.role_in_team}` : null,
    m.context ? `**Контекст:** ${m.context}` : null,
    m.director_request ? `**Запрос директора:** ${m.director_request}` : null,
    m.strengths ? `**Сильные стороны (карточка):** ${m.strengths}` : null,
    m.weaknesses ? `**Зоны роста (карточка):** ${m.weaknesses}` : null,
    m.consultant_comments ? `**Комментарии консультанта к профилю:** ${m.consultant_comments}` : null,
  ]
    .filter(Boolean)
    .join('\n\n') || '(В карточке руководителя нет дополнительного текста)';
}

/**
 * One-shot AI fill of the v1 track from all meetings with textual content (conducted / processed / closed).
 */
export async function synthesizeTrackFromMeetingsHistory(
  supabase: SupabaseClient,
  params: { managerId: string; actingUserId: string; model?: string }
): Promise<SynthesizeTrackResult> {
  const { data: manager, error: mgrErr } = await supabase
    .from('managers')
    .select(
      'id, name, position, role_in_team, context, director_request, strengths, weaknesses, consultant_comments, company_id'
    )
    .eq('id', params.managerId)
    .single();

  if (mgrErr || !manager) {
    return { ok: false, code: 'SAVE', message: 'Руководитель не найден' };
  }

  const { data: companyRow } = await supabase
    .from('companies')
    .select('name')
    .eq('id', manager.company_id)
    .maybeSingle();

  const { data: actorProfile } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('id', params.actingUserId)
    .single();

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
    companyName: companyRow?.name ?? '—',
    consultantName: actorProfile?.name?.trim() || '—',
    actingUserId: params.actingUserId,
  });

  if (!isStructuredTrackContent(trackDoc.content)) {
    return {
      ok: false,
      code: 'NOT_STRUCTURED',
      message: 'Трек не в формате v1. Установите шаблон на вкладке «Трек».',
    };
  }

  const { data: meetingsRaw, error: mtErr } = await supabase
    .from('meetings')
    .select(
      'meeting_number, date, status, transcription_text, key_facts, problems_signals, conclusions, strengths, weaknesses, action_plan, next_scenario'
    )
    .eq('manager_id', params.managerId)
    .in('status', ['conducted', 'processed', 'closed'])
    .order('meeting_number', { ascending: true });

  if (mtErr) {
    return { ok: false, code: 'SAVE', message: mtErr.message };
  }

  const meetings = (meetingsRaw ?? []).filter(meetingHasUsableContent);
  if (meetings.length === 0) {
    return {
      ok: false,
      code: 'NO_MEETINGS',
      message:
        'Нет встреч с заполненной расшифровкой или полями анализа (проведена/обработана/закрыта). Добавьте материалы и повторите.',
    };
  }

  const meetingsArchive = buildMeetingsArchive(meetings);
  const managerProfileBlock = buildManagerProfileBlock(manager);

  const prompt = buildTrackSynthesizeFromHistoryPrompt({
    managerName: manager.name,
    companyName: companyRow?.name ?? '—',
    position: manager.position,
    managerProfileBlock,
    meetingsArchive,
  });

  let raw: string;
  try {
    raw = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: 12_000,
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

  const merged = mergeTrackSectionUpdates(trackDoc.content, parsed.updates);
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

  return { ok: true, document_id: trackDoc.id };
}
