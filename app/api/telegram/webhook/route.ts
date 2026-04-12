import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const message = body?.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const text: string = message.text.trim();

  const supabase = createServiceClient();

  // Find managers whose name appears in the message
  const { data: managers } = await supabase
    .from('managers')
    .select('id, name, company_id');

  let targetManagerId: string | null = null;
  let eventText = text;

  if (managers) {
    for (const manager of managers) {
      const nameParts = manager.name.split(' ');
      const firstName = nameParts[0];
      if (text.toLowerCase().includes(manager.name.toLowerCase()) || text.toLowerCase().includes(firstName.toLowerCase())) {
        targetManagerId = manager.id;
        // Strip the name prefix if present (e.g. "Ксения: текст")
        const colonIdx = text.indexOf(':');
        if (colonIdx > -1 && colonIdx < 50) {
          eventText = text.slice(colonIdx + 1).trim();
        }
        break;
      }
    }
  }

  if (!targetManagerId) {
    await sendTelegramMessage(
      `❌ Не удалось определить руководителя из сообщения.\n\nФормат: "Имя руководителя: текст события"`
    ).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from('interim_events').insert({
    manager_id: targetManagerId,
    text: eventText,
    source: 'telegram',
  });

  if (error) {
    await sendTelegramMessage(`❌ Ошибка сохранения: ${error.message}`).catch(() => {});
  } else {
    await sendTelegramMessage(`✅ Событие добавлено в карточку руководителя.`).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
