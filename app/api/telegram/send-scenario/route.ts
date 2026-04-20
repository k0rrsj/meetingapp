import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  escapeTelegramHtml,
  sendTelegramMessageToChat,
  splitTelegramMessage,
} from '@/lib/telegram';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { meeting_id } = await request.json();
  if (!meeting_id) {
    return NextResponse.json({ error: 'meeting_id обязателен' }, { status: 400 });
  }

  const [{ data: meeting }, { data: settings }] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, meeting_number, date, scenario, scenario_approved_at, manager:managers(name)')
      .eq('id', meeting_id)
      .single(),
    supabase
      .from('ai_settings')
      .select('telegram_chat_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!meeting) {
    return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });
  }
  if (!meeting.scenario?.trim()) {
    return NextResponse.json({ error: 'Сценарий пустой' }, { status: 400 });
  }
  if (!meeting.scenario_approved_at) {
    return NextResponse.json({ error: 'Сначала утвердите сценарий' }, { status: 400 });
  }

  const chatId = settings?.telegram_chat_id?.trim();
  if (!chatId) {
    return NextResponse.json(
      { error: 'Не указан Telegram chat ID. Добавьте его в Настройки AI.' },
      { status: 400 },
    );
  }

  const managerName = (meeting.manager as { name?: string } | null)?.name ?? 'руководитель';
  const title = [
    `Сценарий встречи №${meeting.meeting_number}`,
    meeting.date ? `(${meeting.date})` : null,
    `для ${managerName}`,
  ].filter(Boolean).join(' ');

  const content = `<b>${escapeTelegramHtml(title)}</b>\n\n${escapeTelegramHtml(meeting.scenario)}`;
  const parts = splitTelegramMessage(content);

  for (let i = 0; i < parts.length; i += 1) {
    const prefix = parts.length > 1 ? `<b>Часть ${i + 1}/${parts.length}</b>\n` : '';
    await sendTelegramMessageToChat(chatId, `${prefix}${parts[i]}`);
  }

  return NextResponse.json({ success: true, parts: parts.length });
}
