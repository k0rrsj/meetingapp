import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { LeaderProfileChangeWithMeeting } from '@/types';

const LIMIT = 8;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('leader_profile_changes')
    .select('id, manager_id, meeting_id, changed_by, summary, created_at, meeting:meetings(meeting_number)')
    .eq('manager_id', id)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  // Table may not exist yet (migration 013 not applied). Degrade gracefully so
  // the UI just shows the fallback message instead of erroring.
  if (error) {
    return NextResponse.json({ changes: [], latest_meeting_number: null });
  }

  const changes: LeaderProfileChangeWithMeeting[] = (data ?? []).map((row) => {
    const meeting = Array.isArray(row.meeting) ? row.meeting[0] : row.meeting;
    return {
      id: row.id,
      manager_id: row.manager_id,
      meeting_id: row.meeting_id,
      changed_by: row.changed_by,
      summary: row.summary,
      created_at: row.created_at,
      meeting_number: meeting?.meeting_number ?? null,
    };
  });

  const latest_meeting_number =
    changes.find((c) => c.meeting_number != null)?.meeting_number ?? null;

  return NextResponse.json({ changes, latest_meeting_number });
}
