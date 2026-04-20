import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callOpenRouter, SCENARIO_OUTPUT_MAX_TOKENS } from '@/lib/openrouter/client';
import { buildAgentSystemPrompt } from '@/lib/prompts/agent';
import { fetchCompanyDocs } from '@/lib/context/company-docs';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { meeting_id, edited_scenario } = await request.json();
  if (!meeting_id || !edited_scenario?.trim()) {
    return NextResponse.json({ error: 'meeting_id и edited_scenario обязательны' }, { status: 400 });
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*, manager:managers(*)')
    .eq('id', meeting_id)
    .single();

  if (!meeting) return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });

  const manager = meeting.manager;

  const [aiSettingsResult, trackResult, companyDocs] = await Promise.all([
    supabase.from('ai_settings').select('preferred_model').eq('user_id', user.id).single(),
    supabase.from('documents').select('content').eq('manager_id', meeting.manager_id).eq('type', 'track').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    fetchCompanyDocs(supabase, manager.company_id),
  ]);

  const model = aiSettingsResult.data?.preferred_model ?? 'anthropic/claude-opus-4-5';

  const agentSystemPrompt = buildAgentSystemPrompt({
    manager,
    trackContent: trackResult.data?.content ?? null,
    companyDocs,
  });

  const fromThird = meeting.meeting_number >= 3;
  const thirdPlusRules = fromThird
    ? `

Дополнительно для встречи №${meeting.meeting_number} (№3 и далее):
- В блоке 3 в начале должен быть подраздел «Приоритет сюжетов на эту встречу»: ровно два сюжета с обоснованием каждого; не раздувай до списка всего важного.
- В блоке 4 у каждой договорённости обязательно строки «Дедлайн:» и «Формат отчёта:». Если в черновике их нет — добавь, согласуясь с смыслом правок консультанта.`
    : '';

  const system = `${agentSystemPrompt}

Ты помогаешь консультанту улучшить сценарий сессии. Консультант отредактировал черновик и хочет, чтобы ты его улучшил, сохранив внесённые правки как основу.

Правила:
- Сохрани структуру из 4 блоков (Чек-ин / Проверка договорённостей / Основной блок / Фиксация)
- Уважай правки консультанта — они отражают его намерения
- Улучши формулировки, добавь конкретику там, где её не хватает
- Не добавляй темы, которых нет в отредактированном варианте
- Язык: русский${thirdPlusRules}`;

  const userMsg = `Отредактированный консультантом сценарий:

${edited_scenario}

Улучши этот сценарий, сохранив внесённые правки как основу.`;

  try {
    const refined = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
      max_tokens: SCENARIO_OUTPUT_MAX_TOKENS,
      temperature: 0.5,
    });

    await supabase.from('meetings').update({ scenario: refined }).eq('id', meeting_id);

    return NextResponse.json({ scenario: refined });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Сервис AI временно недоступен';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
