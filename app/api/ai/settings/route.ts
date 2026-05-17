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

  if (profile?.role !== 'consultant' && profile?.role !== 'assistant') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const body = await request.json();
  const {
    preferred_model,
    scenario_model,
    analysis_model,
    chat_model,
    telegram_chat_id,
    meeting_reminder_enabled,
  } = body;

  if (!preferred_model) {
    return NextResponse.json({ error: 'preferred_model обязателен' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    preferred_model,
    scenario_model: scenario_model ?? preferred_model,
    analysis_model: analysis_model ?? preferred_model,
    chat_model: chat_model ?? preferred_model,
    telegram_chat_id: telegram_chat_id?.trim() || null,
  };
  if (typeof meeting_reminder_enabled === 'boolean') {
    payload.meeting_reminder_enabled = meeting_reminder_enabled;
  }

  const { data: existing } = await supabase
    .from('ai_settings')
    .select('id')
    .eq('user_id', user.id)
    .single();

  const selectFields = 'preferred_model, scenario_model, analysis_model, chat_model, telegram_chat_id, meeting_reminder_enabled, updated_at';

  let result;
  if (existing) {
    result = await supabase
      .from('ai_settings')
      .update(payload)
      .eq('user_id', user.id)
      .select(selectFields)
      .single();
  } else {
    result = await supabase
      .from('ai_settings')
      .insert({ user_id: user.id, ...payload })
      .select(selectFields)
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
