import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureCanonicalTrackDocument } from '@/lib/track/ensure-canonical';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: managerId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data: manager, error: mErr } = await supabase
    .from('managers')
    .select('id, name, position, company_id')
    .eq('id', managerId)
    .single();

  if (mErr || !manager) {
    return NextResponse.json({ error: 'Руководитель не найден' }, { status: 404 });
  }

  const { data: companyRow } = await supabase
    .from('companies')
    .select('name')
    .eq('id', manager.company_id)
    .maybeSingle();

  const { data: profile } = await supabase.from('user_profiles').select('name').eq('id', user.id).single();

  try {
    const { document, created } = await ensureCanonicalTrackDocument(supabase, {
      managerId: manager.id,
      managerName: manager.name,
      position: manager.position,
      companyName: companyRow?.name ?? '—',
      consultantName: profile?.name?.trim() || '—',
      actingUserId: user.id,
    });

    return NextResponse.json({ document, created });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
