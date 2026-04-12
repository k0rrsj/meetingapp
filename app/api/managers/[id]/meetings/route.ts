import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildPreviousContextText,
  buildPreviousContextJson,
  extractConsultantComments,
} from '@/lib/context-builder';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: managerId } = await params;
  const supabase = await createClient();

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('manager_id', managerId)
    .order('meeting_number', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(meetings ?? []);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: managerId } = await params;
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

  // Get manager profile
  const { data: manager } = await supabase
    .from('managers')
    .select('*')
    .eq('id', managerId)
    .single();

  if (!manager) {
    return NextResponse.json({ error: 'Руководитель не найден' }, { status: 404 });
  }

  // Step 1: find previous meeting
  const { data: previousMeetings } = await supabase
    .from('meetings')
    .select('*')
    .eq('manager_id', managerId)
    .order('meeting_number', { ascending: false })
    .limit(1);

  const previousMeeting = previousMeetings?.[0] ?? null;
  const lastMeetingNumber = previousMeeting?.meeting_number ?? 0;
  const contextFromUnclosed = previousMeeting
    ? previousMeeting.status !== 'closed'
    : false;

  let previousContextText: string | null = null;
  let previousContextJson = null;

  // Step 2: build context
  if (previousMeeting) {
    // Get comments for previous meeting
    const { data: meetingComments } = await supabase
      .from('comments')
      .select('text, user_profile:user_profiles(role)')
      .eq('target_type', 'meeting')
      .eq('target_id', previousMeeting.id);

    // Get last 3 consultant comments on manager profile
    const { data: profileComments } = await supabase
      .from('comments')
      .select('text, user_profile:user_profiles(role)')
      .eq('target_type', 'manager')
      .eq('target_id', managerId)
      .order('created_at', { ascending: false })
      .limit(3);

    const consultantMeetingComments = extractConsultantComments(
      (meetingComments ?? []) as unknown as { text: string; user_profile?: { role: string } }[]
    );
    const consultantProfileComments = extractConsultantComments(
      (profileComments ?? []) as unknown as { text: string; user_profile?: { role: string } }[]
    );

    previousContextText = buildPreviousContextText(
      previousMeeting,
      consultantMeetingComments,
      consultantProfileComments
    );

    previousContextJson = buildPreviousContextJson(
      previousMeeting,
      consultantMeetingComments,
      consultantProfileComments
    );
  }

  // Step 3: create meeting record
  const { data: newMeeting, error } = await supabase
    .from('meetings')
    .insert({
      manager_id: managerId,
      meeting_number: lastMeetingNumber + 1,
      date: null,
      type: manager.work_type === 'diagnostics' ? 'diagnostics' : 'one_to_one',
      status: 'preparation',
      previous_context_text: previousContextText,
      previous_context_json: previousContextJson,
      context_from_unclosed: contextFromUnclosed,
      scenario: null,
      transcription_prompt: null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(newMeeting, { status: 201 });
}
