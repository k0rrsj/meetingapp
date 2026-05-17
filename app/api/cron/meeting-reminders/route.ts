import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessageToChat } from '@/lib/telegram';

/**
 * Vercel Cron Job — runs daily at 06:00 UTC (09:00 MSK).
 * Sends Telegram notifications with active problems for meetings scheduled tomorrow.
 *
 * Configure in vercel.json:
 * { "crons": [{ "path": "/api/cron/meeting-reminders", "schedule": "0 6 * * *" }] }
 *
 * Protected by CRON_SECRET env variable.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // Find all meetings scheduled for tomorrow with status 'preparation'
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select(`
      id,
      meeting_number,
      date,
      manager:managers (
        id,
        name,
        company_id
      )
    `)
    .eq('date', tomorrowStr)
    .eq('status', 'preparation');

  if (error) {
    console.error('[cron/meeting-reminders] DB error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!meetings || meetings.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No meetings tomorrow' });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const meeting of meetings) {
    const manager = Array.isArray(meeting.manager) ? meeting.manager[0] : meeting.manager;
    if (!manager) continue;

    // Get AI settings for any user to find telegram_chat_id and reminder preference
    // (settings are per-user; we use the first consultant's settings)
    const { data: settingsList } = await supabase
      .from('ai_settings')
      .select('telegram_chat_id, meeting_reminder_enabled')
      .eq('meeting_reminder_enabled', true)
      .not('telegram_chat_id', 'is', null)
      .limit(1);

    const settings = settingsList?.[0];
    if (!settings?.telegram_chat_id) continue;

    // Fetch active problems for this manager
    const { data: problems } = await supabase
      .from('manager_problems')
      .select('id, text, meeting_count')
      .eq('manager_id', manager.id)
      .eq('status', 'active')
      .order('meeting_count', { ascending: false });

    const dateFormatted = new Date(meeting.date + 'T00:00:00').toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    });

    if (!problems || problems.length === 0) {
      // Simple reminder without problems
      const text = `📅 <b>Встреча №${meeting.meeting_number} с ${manager.name}</b> — ${dateFormatted}\n\nАктивных проблем нет. Удачной встречи!`;
      try {
        await sendTelegramMessageToChat(settings.telegram_chat_id, text);
        sent++;
      } catch (err) {
        errors.push(`Manager ${manager.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
      continue;
    }

    // Build message with inline keyboard buttons
    const problemLines = problems
      .map((p, i) => `${i + 1}. ${p.text} <i>(${p.meeting_count} ${meetingWord(p.meeting_count)})</i>`)
      .join('\n');

    const text = `📅 <b>Встреча №${meeting.meeting_number} с ${manager.name}</b> — ${dateFormatted}\n\nАктивные проблемы:\n${problemLines}\n\nНажмите кнопку, чтобы отметить решённые:`;

    // Build inline keyboard: one button per problem
    const inlineKeyboard = problems.map((p, i) => [
      {
        text: `✅ Закрыть №${i + 1}: ${p.text.slice(0, 40)}${p.text.length > 40 ? '…' : ''}`,
        callback_data: `resolve_problem:${p.id}`,
      },
    ]);

    try {
      await sendTelegramMessageWithKeyboard(
        settings.telegram_chat_id,
        text,
        inlineKeyboard,
      );
      sent++;
    } catch (err) {
      errors.push(`Manager ${manager.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ sent, total: meetings.length, errors });
}

async function sendTelegramMessageWithKeyboard(
  chatId: string,
  text: string,
  inlineKeyboard: Array<Array<{ text: string; callback_data: string }>>,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram API error: ${res.status} ${err}`);
  }
}

function meetingWord(count: number): string {
  if (count === 1) return 'встреча';
  if (count >= 2 && count <= 4) return 'встречи';
  return 'встреч';
}
