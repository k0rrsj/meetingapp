import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callOpenRouter } from '@/lib/openrouter/client';
import { buildAnalyzeTranscriptionPrompt } from '@/lib/prompts/analyze-transcription';
import { buildAgentSystemPrompt } from '@/lib/prompts/agent';
import { fetchCompanyDocs } from '@/lib/context/company-docs';
import type { ProblemDeltaItem } from '@/types';

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

  const [aiSettingsResult, trackResult, consultantDocsResult, companyDocs, activeProblemsResult] = await Promise.all([
    supabase.from('ai_settings').select('preferred_model, analysis_model').eq('user_id', user.id).single(),
    supabase.from('documents').select('content').eq('manager_id', meeting.manager_id).eq('type', 'track').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('consultant_documents').select('title, content').eq('user_id', user.id).eq('is_active', true).order('created_at'),
    fetchCompanyDocs(supabase, manager.company_id),
    supabase.from('manager_problems').select('id, text').eq('manager_id', meeting.manager_id).eq('status', 'active').order('created_at'),
  ]);

  const settings = aiSettingsResult.data;
  const model = settings?.analysis_model ?? settings?.preferred_model ?? 'anthropic/claude-opus-4-5';
  const activeProblems = activeProblemsResult.data ?? [];

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
    },
    activeProblems,
  );

  try {
    const raw = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: agentSystemPrompt + '\n\n' + prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: 4500,
      temperature: 0,
    });

    let analysis: Record<string, unknown>;
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
      analysis = parsed as Record<string, unknown>;
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

    const updates: Partial<Record<typeof fields[number], string>> & { diagnostic_extension?: Record<string, unknown> } = {};
    for (const field of fields) {
      if (typeof analysis[field] === 'string' && analysis[field].trim()) {
        updates[field] = analysis[field].trim();
      }
    }

    if (
      analysis.diagnostic_extension &&
      typeof analysis.diagnostic_extension === 'object' &&
      !Array.isArray(analysis.diagnostic_extension)
    ) {
      updates.diagnostic_extension = analysis.diagnostic_extension as Record<string, unknown>;
    }

    await supabase.from('meetings').update(updates).eq('id', meeting_id);

    // Process problems_delta — update manager_problems table
    const problemsDelta = analysis.problems_delta;
    if (Array.isArray(problemsDelta) && problemsDelta.length > 0) {
      for (const item of problemsDelta as ProblemDeltaItem[]) {
        try {
          if (item.action === 'new' && item.text?.trim()) {
            await supabase.from('manager_problems').insert({
              manager_id: meeting.manager_id,
              text: item.text.trim(),
              status: 'active',
              source: 'ai',
              first_seen_meeting_id: meeting_id,
              meeting_count: 1,
            });
          } else if (item.action === 'ongoing' && item.problem_id) {
            const { data: prob } = await supabase
              .from('manager_problems')
              .select('meeting_count')
              .eq('id', item.problem_id)
              .single();
            if (prob) {
              await supabase
                .from('manager_problems')
                .update({ meeting_count: prob.meeting_count + 1 })
                .eq('id', item.problem_id);
            }
          } else if (item.action === 'resolved' && item.problem_id) {
            await supabase
              .from('manager_problems')
              .update({ status: 'resolved', resolved_meeting_id: meeting_id })
              .eq('id', item.problem_id);
          }
        } catch {
          // Best-effort — don't fail the main response if delta processing fails
        }
      }
    }

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
