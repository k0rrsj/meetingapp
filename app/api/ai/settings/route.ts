import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'consultant') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const { preferred_model, telegram_chat_id } = await request.json();

  if (!preferred_model) {
    return NextResponse.json({ error: 'preferred_model обязателен' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('ai_settings')
    .select('id')
    .eq('user_id', user.id)
    .single();

  let result;
  if (existing) {
    result = await supabase
      .from('ai_settings')
      .update({ preferred_model, telegram_chat_id: telegram_chat_id?.trim() || null })
      .eq('user_id', user.id)
      .select('preferred_model, telegram_chat_id, updated_at')
      .single();
  } else {
    result = await supabase
      .from('ai_settings')
      .insert({ user_id: user.id, preferred_model, telegram_chat_id: telegram_chat_id?.trim() || null })
      .select('preferred_model, telegram_chat_id, updated_at')
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
