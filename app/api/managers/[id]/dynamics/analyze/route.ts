import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callOpenRouter } from '@/lib/openrouter/client';
import { safeParseAiJson } from '@/lib/ai/safe-parse';
import { validateDynamicsSnapshot } from '@/lib/ai/schemas';
import { logAiError } from '@/lib/ai/log';

const ACTION = 'dynamics-analyze';
const ENDPOINT = '/api/managers/[id]/dynamics/analyze';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: managerId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const [{ data: manager, error: managerError }, { data: meetings, error: meetingsError }, { data: aiSettings }] = await Promise.all([
    supabase
      .from('managers')
      .select('id, name, position, context, director_request, strengths, weaknesses')
      .eq('id', managerId)
      .single(),
    supabase
      .from('meetings')
      .select(
        'meeting_number, date, status, key_facts, problems_signals, conclusions, action_plan, next_scenario',
      )
      .eq('manager_id', managerId)
      .order('meeting_number', { ascending: true }),
    supabase.from('ai_settings').select('preferred_model').eq('user_id', user.id).maybeSingle(),
  ]);

  if (managerError || !manager) {
    return NextResponse.json({ error: 'Руководитель не найден' }, { status: 404 });
  }
  if (meetingsError) {
    return NextResponse.json({ error: `Не удалось загрузить встречи: ${meetingsError.message}` }, { status: 500 });
  }

  const rows = meetings ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Нет встреч для анализа' }, { status: 400 });
  }

  const model = aiSettings?.preferred_model ?? 'anthropic/claude-opus-4-5';

  const system = `Ты аналитик межсессионной динамики управленческого консультирования.
Верни ТОЛЬКО валидный JSON, без markdown и пояснений.

Формат:
{
  "installations": [
    {
      "meeting_number": 1,
      "thesis": "...",
      "status": "accepted_intellectually | applied_in_action | normalized | not_accepted",
      "evidence": "короткое подтверждение"
    }
  ],
  "patterns": [
    {
      "name": "...",
      "mechanics": "...",
      "was": "...",
      "became": "...",
      "dynamics": "strengthened | weakened | counterexample | unchanged",
      "evidence": "короткое подтверждение"
    }
  ],
  "commitments": [
    {
      "text": "...",
      "status": "promised | completed | postponed | ignored",
      "source_meeting": 2,
      "due": "...",
      "comment": "..."
    }
  ],
  "summary": {
    "promised": 0,
    "completed": 0,
    "postponed": 0,
    "ignored": 0
  }
}

Правила:
- По договорённостям верни СПИСОК конкретных пунктов, не только агрегаты.
- Если данных не хватает, оставляй массивы пустыми, но summary заполни числами.
- Используй только входной контекст, ничего не придумывай.`;

  const userPrompt = `Профиль руководителя:
${JSON.stringify(manager, null, 2)}

Встречи (по порядку):
${JSON.stringify(rows, null, 2)}

Собери межсессионную динамику в JSON по формату выше.`;

  try {
    const raw = await callOpenRouter({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4500,
      temperature: 0.2,
    });

    const parsed = safeParseAiJson({
      raw,
      validate: validateDynamicsSnapshot,
      context: { action: ACTION, endpoint: ENDPOINT, managerId, model },
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 502 });
    }

    const persistedAt = new Date().toISOString();
    const { error: saveError } = await supabase
      .from('managers')
      .update({
        dynamics_snapshot: parsed.data,
        dynamics_snapshot_updated_at: persistedAt,
      })
      .eq('id', managerId);

    if (saveError) {
      const needsMigration =
        /column .* does not exist|schema cache|dynamics_snapshot/i.test(saveError.message);
      return NextResponse.json(
        {
          error: needsMigration
            ? 'Динамика рассчитана, но не сохранена: не применена миграция для dynamics_snapshot. Примените новые SQL-миграции и повторите.'
            : `Динамика рассчитана, но не сохранена: ${saveError.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ...parsed.data, persisted: true, persisted_at: persistedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Сервис AI временно недоступен';
    logAiError({ action: ACTION, endpoint: ENDPOINT, managerId, model }, 'api', { detail: message });
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
