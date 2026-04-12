import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callOpenRouter } from '@/lib/openrouter/client';
import { buildAnalyzeTranscriptionPrompt } from '@/lib/prompts/analyze-transcription';
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

  if (!meeting.transcription_text) {
    return NextResponse.json(
      { error: 'Нет текста расшифровки для анализа' },
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

  const prompt = buildAnalyzeTranscriptionPrompt(
    meeting.transcription_text,
    meeting.previous_context_text,
    {
      name: manager.name,
      position: manager.position,
      context: manager.context,
    }
  );

  try {
    const raw = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: agentSystemPrompt + '\n\n' + prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: 2500,
      temperature: 0,
    });

    let analysis: Record<string, string>;
    try {
      let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
        // If result is a string — it was double-encoded, parse again
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
      } catch {
        // Try to extract JSON object with regex
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON object found');
        let extracted = match[0];
        parsed = JSON.parse(extracted);
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
      }
      analysis = parsed as Record<string, string>;
    } catch {
      console.error('[analyze-transcription] Raw AI response:', raw);
      return NextResponse.json(
        { error: 'AI вернул некорректный формат. Попробуйте снова.' },
        { status: 502 }
      );
    }

    const fields = [
      'key_facts',
      'problems_signals',
      'conclusions',
      'strengths',
      'weaknesses',
      'action_plan',
      'next_scenario',
    ] as const;

    const updates: Partial<Record<typeof fields[number], string>> = {};
    for (const field of fields) {
      if (typeof analysis[field] === 'string' && analysis[field].trim()) {
        updates[field] = analysis[field].trim();
      }
    }

    await supabase.from('meetings').update(updates).eq('id', meeting_id);

    // Extract mentioned people — return candidates for user to confirm
    let peopleCandidates: Array<{ name: string; position?: string; context?: string }> = [];
    try {
      const extractRaw = await callOpenRouter({
        model,
        messages: [
          {
            role: 'system',
            content: `Извлеки из текста расшифровки список упомянутых людей (кроме самого руководителя — ${manager.name}).
Верни ТОЛЬКО валидный JSON массив без markdown:
[{"name": "Имя Фамилия", "position": "должность если известна", "context": "краткий контекст кто это"}]
Если людей нет — верни пустой массив [].`,
          },
          { role: 'user', content: meeting.transcription_text },
        ],
        max_tokens: 500,
        temperature: 0.2,
      });

      try {
        const cleanedPeople = extractRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleanedPeople);
        if (Array.isArray(parsed)) peopleCandidates = parsed;
      } catch {
        peopleCandidates = [];
      }

      // Filter out already existing managers
      if (peopleCandidates.length > 0) {
        const { data: existingManagers } = await supabase
          .from('managers')
          .select('name')
          .eq('company_id', manager.company_id);

        const existingNames = new Set(
          (existingManagers ?? []).map((m: { name: string }) => m.name.toLowerCase().trim())
        );

        peopleCandidates = peopleCandidates.filter(
          (p) => p.name && !existingNames.has(p.name.toLowerCase().trim())
        );
      }
    } catch {
      // Best-effort, don't fail the main response
    }

    return NextResponse.json({ ...updates, people_candidates: peopleCandidates });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Сервис AI временно недоступен';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
