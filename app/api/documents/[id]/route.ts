import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Документ не найден' }, { status: 404 });

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data: existing } = await supabase.from('documents').select('content').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Документ не найден' }, { status: 404 });

  const body = await request.json();
  const updates: Record<string, string> = {};
  if (typeof body.title === 'string') updates.title = body.title;
  if (typeof body.content === 'string') updates.content = body.content;
  if (typeof body.type === 'string') updates.type = body.type;

  if (typeof body.content === 'string' && body.content !== existing.content) {
    await supabase.from('document_versions').insert({
      document_id: id,
      content: existing.content,
      created_by: user.id,
    });
  }

  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const { data: doc } = await supabase
    .from('documents')
    .select('id, company_id')
    .eq('id', id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 });
  }

  const role = profile?.role;
  const isAssistant = role === 'assistant';
  const isConsultantCompanyLib = role === 'consultant' && doc.company_id != null;

  if (!isAssistant && !isConsultantCompanyLib) {
    return NextResponse.json(
      { error: 'Удалять могут ассистент (любые документы) или консультант — только файлы библиотеки компании' },
      { status: 403 }
    );
  }

  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
