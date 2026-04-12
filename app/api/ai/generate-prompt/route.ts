import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callOpenRouter } from '@/lib/openrouter/client';
import { buildTranscriptionPrompt } from '@/lib/prompts/transcription-prompt';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { meeting_id } = await request.json();

  if (!meeting_id) {
    return NextResponse.json({ error: 'meeting_id обязателен' }, { status: 400 });
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('scenario')
    .eq('id', meeting_id)
    .single();

  if (!meeting?.scenario) {
    return NextResponse.json(
      { error: 'Для генерации промпта необходим сценарий встречи' },
      { status: 400 }
    );
  }

  const { data: aiSettings } = await supabase
    .from('ai_settings')
    .select('preferred_model')
    .eq('user_id', user.id)
    .single();

  const model = aiSettings?.preferred_model ?? 'anthropic/claude-opus-4-5';
  const prompt = buildTranscriptionPrompt(meeting.scenario);

  try {
    const transcriptionPrompt = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: 1500,
    });

    await supabase
      .from('meetings')
      .update({ transcription_prompt: transcriptionPrompt })
      .eq('id', meeting_id);

    return NextResponse.json({ transcription_prompt: transcriptionPrompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Сервис AI временно недоступен';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
