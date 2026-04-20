import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MeetingStatus, UserRole } from '@/types';

const STATUS_EDITABLE_FIELDS_ASSISTANT: Record<MeetingStatus, string[]> = {
  preparation: ['date', 'scenario', 'scenario_approved_at', 'first_meeting_scenario_mode', 'transcription_prompt', 'previous_context_text', 'previous_context_json'],
  conducted: ['date', 'transcription_text', 'transcription_file_url', 'previous_context_text', 'previous_context_json'],
  processed: [
    'key_facts', 'problems_signals', 'conclusions',
    'strengths', 'weaknesses', 'action_plan', 'next_scenario',
    'diagnostic_extension',
    'previous_context_text', 'previous_context_json',
  ],
  closed: [],
};

/** Consultant: prep materials + context; context also in later statuses */
const STATUS_EDITABLE_FIELDS_CONSULTANT: Record<MeetingStatus, string[]> = {
  preparation: ['date', 'scenario', 'scenario_approved_at', 'first_meeting_scenario_mode', 'transcription_prompt', 'previous_context_text', 'previous_context_json'],
  conducted: ['previous_context_text', 'previous_context_json'],
  processed: ['previous_context_text', 'previous_context_json', 'diagnostic_extension'],
  closed: [],
};

function allowedFieldsForRole(role: UserRole | undefined, status: MeetingStatus): string[] {
  if (role === 'consultant') return STATUS_EDITABLE_FIELDS_CONSULTANT[status] ?? [];
  if (role === 'assistant') return STATUS_EDITABLE_FIELDS_ASSISTANT[status] ?? [];
  return [];
}

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

  const role = profile?.role as UserRole | undefined;
  if (role !== 'assistant' && role !== 'consultant') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('status, meeting_number')
    .eq('id', id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });
  }

  const body = await request.json();
  const allowedFields = allowedFieldsForRole(role, meeting.status as MeetingStatus);
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

  if ('previous_context_text' in updates && !('previous_context_json' in body)) {
    updates.previous_context_json = null;
  }

  if ('first_meeting_scenario_mode' in updates) {
    if (meeting.meeting_number !== 1) {
      return NextResponse.json(
        { error: "Поле 'first_meeting_scenario_mode' доступно только для первой встречи" },
        { status: 400 }
      );
    }
    const mode = updates.first_meeting_scenario_mode;
    if (mode !== 'manual' && mode !== 'ai') {
      return NextResponse.json(
        { error: "first_meeting_scenario_mode должен быть 'manual' или 'ai'" },
        { status: 400 }
      );
    }
  }

  // If scenario text changes, approval must be reset unless caller explicitly sets scenario_approved_at.
  if ('scenario' in updates && !('scenario_approved_at' in updates)) {
    updates.scenario_approved_at = null;
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
