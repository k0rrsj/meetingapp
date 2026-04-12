import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build metrics for each company
  const companiesWithMetrics = await Promise.all(
    (companies ?? []).map(async (company) => {
      const { data: managers } = await supabase
        .from('managers')
        .select('id, status')
        .eq('company_id', company.id);

      const managerIds = (managers ?? []).map((m) => m.id);
      const activeManagersCount = (managers ?? []).filter(
        (m) => m.status === 'in_progress'
      ).length;

      let lastMeetingDate: string | null = null;
      let totalMeetingsCount = 0;
      let closedMeetingsCount = 0;

      if (managerIds.length > 0) {
        const { data: meetings } = await supabase
          .from('meetings')
          .select('date, status')
          .in('manager_id', managerIds);

        totalMeetingsCount = meetings?.length ?? 0;
        closedMeetingsCount =
          meetings?.filter((m) => m.status === 'closed').length ?? 0;

        const dates = (meetings ?? [])
          .map((m) => m.date)
          .filter(Boolean)
          .sort()
          .reverse();
        lastMeetingDate = dates[0] ?? null;
      }

      return {
        ...company,
        active_managers_count: activeManagersCount,
        last_meeting_date: lastMeetingDate,
        total_meetings_count: totalMeetingsCount,
        closed_meetings_count: closedMeetingsCount,
      };
    })
  );

  return NextResponse.json(companiesWithMetrics);
}

export async function POST(request: NextRequest) {
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
  const { name } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Название компании обязательно' }, { status: 400 });
  }

  const { data: company, error } = await supabase
    .from('companies')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(company, { status: 201 });
}
