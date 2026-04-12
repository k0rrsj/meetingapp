import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncTrackFromMeeting } from '@/lib/track/sync-from-meeting';
import { MEETING_STATUS_ORDER, type MeetingStatus } from '@/types';

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

  const { status: newStatus }: { status: MeetingStatus } = await request.json();

  if (!MEETING_STATUS_ORDER.includes(newStatus)) {
    return NextResponse.json({ error: 'Недопустимый статус' }, { status: 400 });
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('status, conclusions, action_plan, manager_id')
    .eq('id', id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });
  }

  const currentIdx = MEETING_STATUS_ORDER.indexOf(meeting.status as MeetingStatus);
  const newIdx = MEETING_STATUS_ORDER.indexOf(newStatus);

  if (newIdx === currentIdx) {
    // Already in the desired status — return current state silently
    const { data: current } = await supabase
      .from('meetings')
      .select('id, status, conducted_at, updated_at')
      .eq('id', id)
      .single();
    return NextResponse.json(current ?? { status: newStatus });
  }

  if (newIdx !== currentIdx + 1) {
    return NextResponse.json(
      { error: `Нельзя перейти из статуса '${meeting.status}' в '${newStatus}'` },
      { status: 400 }
    );
  }

  // Validate required fields when closing
  if (newStatus === 'closed') {
    const missing: string[] = [];
    if (!meeting.conclusions?.trim()) missing.push('conclusions');
    if (!meeting.action_plan?.trim()) missing.push('action_plan');

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'Для закрытия встречи заполните обязательные поля',
          missing_fields: missing,
        },
        { status: 422 }
      );
    }
  }

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'conducted') {
    updates.conducted_at = new Date().toISOString();
  }

  const { data: updated, error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', id)
    .select('id, status, conducted_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let track_sync: Awaited<ReturnType<typeof syncTrackFromMeeting>> | null = null;
  if (newStatus === 'closed' && meeting.manager_id) {
    track_sync = await syncTrackFromMeeting(supabase, {
      meetingId: id,
      actingUserId: user.id,
      respectIdempotency: true,
    });
  }

  return NextResponse.json({ ...updated, track_sync });
}
