import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callOpenRouter } from '@/lib/openrouter/client';
import { buildScenarioPrompt } from '@/lib/prompts/scenario';
import { buildAgentSystemPrompt } from '@/lib/prompts/agent';
import { fetchCompanyDocs } from '@/lib/context/company-docs';

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
    .select('*, manager:managers(*)')
    .eq('id', meeting_id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });
  }

  if (!meeting.previous_context_text) {
    return NextResponse.json(
      { error: 'Для генерации сценария необходим контекст предыдущих встреч' },
      { status: 400 }
    );
  }

  const manager = meeting.manager;

  const [aiSettingsResult, trackResult, consultantDocsResult, companyDocs] = await Promise.all([
    supabase.from('ai_settings').select('preferred_model').eq('user_id', user.id).single(),
    supabase.from('documents').select('content').eq('manager_id', meeting.manager_id).eq('type', 'track').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('consultant_documents').select('title, content').eq('user_id', user.id).eq('is_active', true).order('created_at'),
    fetchCompanyDocs(supabase, manager.company_id),
  ]);

  const model = aiSettingsResult.data?.preferred_model ?? 'anthropic/claude-opus-4-5';

  const agentSystemPrompt = buildAgentSystemPrompt({
    manager,
    trackContent: trackResult.data?.content ?? null,
    consultantDocs: consultantDocsResult.data ?? null,
    companyDocs,
  });

  const prompt = buildScenarioPrompt(
    meeting.previous_context_text,
    {
      name: manager.name,
      position: manager.position,
      context: manager.context,
      directorRequest: manager.director_request,
      strengths: manager.strengths,
      weaknesses: manager.weaknesses,
      consultantComments: manager.consultant_comments,
    },
    meeting.meeting_number,
  );

  try {
    const scenario = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: agentSystemPrompt + '\n\n' + prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: 3000,
    });

    // Save to DB
    await supabase.from('meetings').update({ scenario }).eq('id', meeting_id);

    return NextResponse.json({ scenario });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Сервис AI временно недоступен';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
