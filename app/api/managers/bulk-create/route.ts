import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { meeting_id, people } = await request.json();

  if (!meeting_id || !Array.isArray(people) || people.length === 0) {
    return NextResponse.json({ error: 'meeting_id и people обязательны' }, { status: 400 });
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('meeting_number, manager_id, manager:managers(name, company_id)')
    .eq('id', meeting_id)
    .single();

  if (!meeting) return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });

  const m = meeting.manager as { name: string; company_id: string } | { name: string; company_id: string }[] | null;
  const managerRow = Array.isArray(m) ? m[0] : m;
  if (!managerRow) return NextResponse.json({ error: 'Нет данных руководителя' }, { status: 400 });
  const manager = managerRow;
  const created: { name: string; id: string }[] = [];

  for (const person of people) {
    if (!person.name?.trim()) continue;

    const { data } = await supabase
      .from('managers')
      .insert({
        company_id: manager.company_id,
        name: person.name.trim(),
        position: person.position ?? null,
        context: person.context
          ? `Упомянут в расшифровке встречи №${meeting.meeting_number} с ${manager.name}. ${person.context}`
          : `Упомянут в расшифровке встречи №${meeting.meeting_number} с ${manager.name}.`,
        work_type: 'one_to_one',
        status: 'in_progress',
      })
      .select('id, name')
      .single();

    if (data) created.push({ id: data.id, name: data.name });
  }

  if (created.length > 0) {
    const names = created.map((c) => `• ${c.name}`).join('\n');
    const text = `👥 <b>Новые карточки созданы</b>\n\nВстреча №${meeting.meeting_number} с ${manager.name}\n\n${names}`;
    try {
      await sendTelegramMessage(text);
    } catch {
      // Telegram уведомление — не критично
    }
  }

  return NextResponse.json({ created });
}
