import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncTrackFromMeeting } from '@/lib/track/sync-from-meeting';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: managerId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const meeting_id = typeof body.meeting_id === 'string' ? body.meeting_id : '';
  const force_resync = body.force_resync === true;

  if (!meeting_id) {
    return NextResponse.json({ error: 'meeting_id обязателен' }, { status: 400 });
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('manager_id')
    .eq('id', meeting_id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });
  }

  if (meeting.manager_id !== managerId) {
    return NextResponse.json({ error: 'Встреча относится к другому руководителю' }, { status: 400 });
  }

  const result = await syncTrackFromMeeting(supabase, {
    meetingId: meeting_id,
    actingUserId: user.id,
    respectIdempotency: !force_resync,
  });

  if (!result.ok) {
    const status =
      result.code === 'NOT_STRUCTURED' ? 409 : result.code === 'MEETING_NOT_FOUND' ? 404 : 422;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  return NextResponse.json({
    document_id: result.document_id,
    skipped: result.skipped,
    skip_reason: result.skip_reason,
  });
}
