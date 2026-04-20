const TELEGRAM_API = 'https://api.telegram.org/bot';
const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

export async function sendTelegramMessage(text: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn('[Telegram] TELEGRAM_CHAT_ID not set — skipping notification');
    return;
  }
  await sendTelegramMessageToChat(chatId, text);
}

export async function sendTelegramMessageToChat(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set — skipping notification');
    return;
  }

  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram API error: ${res.status} ${err}`);
  }
}

export function escapeTelegramHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function splitTelegramMessage(text: string, maxLength = TELEGRAM_MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    const candidate = remaining.slice(0, maxLength);
    const splitIdx = Math.max(candidate.lastIndexOf('\n\n'), candidate.lastIndexOf('\n'));
    const idx = splitIdx > maxLength * 0.5 ? splitIdx : maxLength;
    const head = remaining.slice(0, idx).trimEnd();
    parts.push(head);
    remaining = remaining.slice(idx).trimStart();
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts;
}

export function formatSessionNotification(
  managerName: string,
  summary: string,
  actionItems: Array<{ what: string; deadline: string; report_format: string }>
): string {
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const lines: string[] = [
    `📋 <b>Сессия с ${managerName}</b> — ${date}`,
    '',
    summary,
  ];

  if (actionItems.length > 0) {
    lines.push('');
    lines.push('<b>Договорённости:</b>');
    actionItems.forEach((item) => {
      lines.push(`• ${item.what} — до ${item.deadline} (${item.report_format})`);
    });
  }

  return lines.join('\n');
}
