import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: manager, error } = await supabase
    .from('managers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !manager) {
    return NextResponse.json({ error: 'Руководитель не найден' }, { status: 404 });
  }

  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, meeting_number, date, status')
    .eq('manager_id', id)
    .order('meeting_number', { ascending: false });

  const meetingsCount = meetings?.length ?? 0;
  const lastMeetingDate =
    meetings?.map((m) => m.date).filter(Boolean).sort().reverse()[0] ?? null;

  return NextResponse.json({
    ...manager,
    meetings: meetings ?? [],
    meetings_count: meetingsCount,
    last_meeting_date: lastMeetingDate,
  });
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

  if (profile?.role !== 'assistant' && profile?.role !== 'consultant') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const { error } = await supabase
    .from('managers')
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

  const body = await request.json();
  const role = profile?.role;

  if (role !== 'assistant' && role !== 'consultant') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const allowedFields = [
    'name', 'position', 'role_in_team', 'context', 'director_request',
    'strengths', 'weaknesses', 'work_type', 'status', 'consultant_comments',
  ];
  const updates: Record<string, unknown> = {};
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  });

  const { data: manager, error } = await supabase
    .from('managers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(manager);
}
