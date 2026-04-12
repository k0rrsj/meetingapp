import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage, formatSessionNotification } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { manager_name, summary, action_items } = await request.json();

  if (!manager_name || !summary) {
    return NextResponse.json({ error: 'manager_name и summary обязательны' }, { status: 400 });
  }

  try {
    const text = formatSessionNotification(manager_name, summary, action_items ?? []);
    await sendTelegramMessage(text);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка отправки';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
