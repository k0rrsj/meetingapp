import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MeetingStatus } from '@/types';

const STATUS_EDITABLE_FIELDS: Record<MeetingStatus, string[]> = {
  preparation: ['date', 'scenario', 'transcription_prompt'],
  conducted: ['date', 'transcription_text', 'transcription_file_url'],
  processed: [
    'key_facts', 'problems_signals', 'conclusions',
    'strengths', 'weaknesses', 'action_plan', 'next_scenario',
  ],
  closed: [],
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !meeting) {
    return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });
  }

  return NextResponse.json(meeting);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  if (profile?.role !== 'assistant') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  if (profile?.role !== 'assistant') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('status')
    .eq('id', id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });
  }

  const body = await request.json();
  const allowedFields = STATUS_EDITABLE_FIELDS[meeting.status as MeetingStatus] ?? [];
  const updates: Record<string, unknown> = {};

  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { error: `Поле '${field}' недоступно для редактирования в статусе '${meeting.status}'` },
        { status: 400 }
      );
    }
    updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
