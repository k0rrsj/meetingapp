const TELEGRAM_API = 'https://api.telegram.org/bot';

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping notification');
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
