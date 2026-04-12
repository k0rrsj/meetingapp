import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;
  const supabase = await createClient();

  const { data: managers, error } = await supabase
    .from('managers')
    .select('*')
    .eq('company_id', companyId)
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const managersWithMetrics = await Promise.all(
    (managers ?? []).map(async (manager) => {
      const { data: meetings } = await supabase
        .from('meetings')
        .select('date')
        .eq('manager_id', manager.id)
        .order('date', { ascending: false });

      const meetingsCount = meetings?.length ?? 0;
      const lastMeetingDate = meetings?.[0]?.date ?? null;

      return { ...manager, meetings_count: meetingsCount, last_meeting_date: lastMeetingDate };
    })
  );

  return NextResponse.json(managersWithMetrics);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;
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

  const body = await request.json();
  const { name, position, role_in_team, context, director_request, strengths, weaknesses, work_type } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Имя руководителя обязательно' }, { status: 400 });
  }

  const { data: manager, error } = await supabase
    .from('managers')
    .insert({
      company_id: companyId,
      name: name.trim(),
      position: position?.trim() || null,
      role_in_team: role_in_team?.trim() || null,
      context: context?.trim() || null,
      director_request: director_request?.trim() || null,
      strengths: strengths?.trim() || null,
      weaknesses: weaknesses?.trim() || null,
      work_type: work_type ?? 'one_to_one',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(manager, { status: 201 });
}
