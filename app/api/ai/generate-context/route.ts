import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { meeting_id } = await request.json();

  const { data: meeting } = await supabase
    .from('meetings')
    .select('previous_context_text, previous_context_json')
    .eq('id', meeting_id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });
  }

  return NextResponse.json({
    context_text: meeting.previous_context_text,
    context_json: meeting.previous_context_json,
  });
}
