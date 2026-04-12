import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AVAILABLE_MODELS } from '@/lib/openrouter/client';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { data: aiSettings } = await supabase
    .from('ai_settings')
    .select('preferred_model')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    models: AVAILABLE_MODELS,
    current_model: aiSettings?.preferred_model ?? 'anthropic/claude-opus-4-5',
  });
}
