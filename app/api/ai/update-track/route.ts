import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callOpenRouter } from '@/lib/openrouter/client';
import { buildUpdateTrackPrompt } from '@/lib/prompts/update-track';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { meeting_id } = await request.json();
  if (!meeting_id) return NextResponse.json({ error: 'meeting_id обязателен' }, { status: 400 });

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*, manager:managers(*)')
    .eq('id', meeting_id)
    .single();

  if (!meeting) return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });

  if (!meeting.transcription_text) {
    return NextResponse.json({ error: 'Нет расшифровки для анализа' }, { status: 400 });
  }

  const [aiSettingsResult, trackResult, consultantDocsResult] = await Promise.all([
    supabase.from('ai_settings').select('preferred_model').eq('user_id', user.id).single(),
    supabase.from('documents').select('id, content').eq('manager_id', meeting.manager_id).eq('type', 'track').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('consultant_documents').select('title, content').eq('user_id', user.id).eq('is_active', true).order('created_at'),
  ]);

  const model = aiSettingsResult.data?.preferred_model ?? 'anthropic/claude-opus-4-5';
  const manager = meeting.manager;
  const sessionDate = meeting.date ?? new Date().toISOString().split('T')[0];

  const prompt = buildUpdateTrackPrompt(
    meeting.transcription_text,
    trackResult.data?.content ?? '',
    sessionDate,
    manager.name
  );

  try {
    const raw = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: 2500,
      temperature: 0.4,
    });

    let analysis: Record<string, unknown>;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'AI вернул некорректный формат. Попробуйте снова.' }, { status: 502 });
    }

    return NextResponse.json({
      analysis,
      track_document_id: trackResult.data?.id ?? null,
      current_track_content: trackResult.data?.content ?? '',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Сервис AI временно недоступен';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
