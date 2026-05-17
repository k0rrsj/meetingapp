import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Telegram Webhook endpoint.
 * Register once after deploy:
 *   POST https://api.telegram.org/bot{TOKEN}/setWebhook
 *   body: { "url": "https://your-app.vercel.app/api/telegram/webhook" }
 *
 * Handles:
 *  - callback_query with data "resolve_problem:{problemId}" — marks problem as resolved
 */
export async function POST(req: NextRequest) {
  let body: TelegramUpdate;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (body.callback_query) {
    await handleCallbackQuery(body.callback_query);
  }

  // Always return 200 to prevent Telegram from retrying
  return NextResponse.json({ ok: true });
}

async function handleCallbackQuery(query: TelegramCallbackQuery) {
  const data = query.data ?? '';
  const callbackQueryId = query.id;
  const chatId = query.message?.chat?.id?.toString();

  if (!data.startsWith('resolve_problem:') || !chatId) {
    await answerCallbackQuery(callbackQueryId, '');
    return;
  }

  const problemId = data.replace('resolve_problem:', '');

  const supabase = await createClient();

  const { data: problem, error } = await supabase
    .from('manager_problems')
    .update({ status: 'resolved', resolved_meeting_id: null })
    .eq('id', problemId)
    .select('text, manager_id')
    .single();

  if (error || !problem) {
    await answerCallbackQuery(callbackQueryId, '❌ Проблема не найдена или уже закрыта.');
    return;
  }

  // Notify user
  await answerCallbackQuery(callbackQueryId, `✅ Закрыто: ${problem.text.slice(0, 200)}`);

  // Update the inline keyboard: replace the resolved button with a struck-through label
  if (query.message?.message_id) {
    await editCallbackButton(
      chatId,
      query.message.message_id,
      query.message.reply_markup,
      data,
    );
  }
}

async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || undefined,
      show_alert: text.length > 0,
    }),
  });
}

async function editCallbackButton(
  chatId: string,
  messageId: number,
  replyMarkup: TelegramInlineKeyboardMarkup | undefined,
  resolvedCallbackData: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !replyMarkup) return;

  // Replace the resolved button text, disable it
  const updatedKeyboard = replyMarkup.inline_keyboard.map((row) =>
    row.map((btn) =>
      btn.callback_data === resolvedCallbackData
        ? { text: `☑️ Закрыта`, callback_data: 'noop' }
        : btn,
    ),
  );

  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: updatedKeyboard },
    }),
  });
}

// ============================================================
// Telegram Update types (minimal subset)
// ============================================================

interface TelegramUpdate {
  update_id: number;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramCallbackQuery {
  id: string;
  data?: string;
  message?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  reply_markup?: TelegramInlineKeyboardMarkup;
}

interface TelegramInlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}
