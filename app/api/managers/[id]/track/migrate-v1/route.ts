import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildStructuredTrackMarkdown } from '@/lib/track/template';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Replaces the latest track document body with the v1 template (destructive).
 * Assistant-only.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: managerId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'assistant') {
    return NextResponse.json({ error: 'Только ассистент может сбросить шаблон' }, { status: 403 });
  }

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

  const { data: nameRow } = await supabase.from('user_profiles').select('name').eq('id', user.id).single();

  const createdDateRu = format(new Date(), 'd MMMM yyyy', { locale: ru });
  const content = buildStructuredTrackMarkdown({
    managerName: manager.name,
    position: manager.position ?? '',
    companyName: companyRow?.name ?? '—',
    consultantName: nameRow?.name?.trim() || '—',
    createdDateRu,
  });

  const { data: track } = await supabase
    .from('documents')
    .select('id, content')
    .eq('manager_id', managerId)
    .eq('type', 'track')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!track) {
    const title = `Трек развития — ${manager.name}`;
    const { data: inserted, error } = await supabase
      .from('documents')
      .insert({
        manager_id: managerId,
        company_id: null,
        title,
        content,
        type: 'track',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ document: inserted, created: true });
  }

  if (track.content !== content) {
    await supabase.from('document_versions').insert({
      document_id: track.id,
      content: track.content,
      created_by: user.id,
    });
  }

  const { data: updated, error: uErr } = await supabase
    .from('documents')
    .update({ content })
    .eq('id', track.id)
    .select()
    .single();

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({ document: updated, created: false });
}
