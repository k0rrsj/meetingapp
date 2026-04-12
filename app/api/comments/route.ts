import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get('target_type');
  const targetId = searchParams.get('target_id');

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'target_type и target_id обязательны' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!comments?.length) return NextResponse.json([]);

  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, name, role')
    .in('id', userIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const result = comments.map((c) => ({
    ...c,
    user_profile: profileMap[c.user_id] ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const body = await request.json();
  const { target_type, target_id, text } = body;

  if (!target_type || !target_id || !text?.trim()) {
    return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 });
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      target_type,
      target_id,
      user_id: user.id,
      text: text.trim(),
    })
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

  return NextResponse.json({ ...comment, user_profile: profile ?? null }, { status: 201 });
}
