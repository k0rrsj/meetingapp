import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const manager_id = searchParams.get('manager_id');
  if (!manager_id) return NextResponse.json({ error: 'manager_id обязателен' }, { status: 400 });

  const { data, error } = await supabase
    .from('interim_events')
    .select('*')
    .eq('manager_id', manager_id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await request.json();
  const { manager_id, text, source = 'app' } = body;

  if (!manager_id || !text?.trim()) {
    return NextResponse.json({ error: 'manager_id и text обязательны' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('interim_events')
    .insert({ manager_id, text: text.trim(), source, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
