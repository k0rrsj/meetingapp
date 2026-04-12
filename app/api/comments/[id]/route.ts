import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const { data: comment } = await supabase
    .from('comments')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!comment) {
    return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 });
  }

  if (comment.user_id !== user.id) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const { text } = await request.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: 'Текст комментария обязателен' }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('comments')
    .update({ text: text.trim() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ ...updated, user_profile: profile ?? null });
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

  const { data: comment } = await supabase
    .from('comments')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!comment) {
    return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 });
  }

  if (comment.user_id !== user.id) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const { error } = await supabase.from('comments').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
