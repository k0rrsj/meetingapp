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
    .from('goals')
    .select('*')
    .eq('manager_id', manager_id)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await request.json();
  const { manager_id, parent_id = null, title, description = null, status = 'planned', progress = 0, order_index = 0 } = body;

  if (!manager_id || !title?.trim()) {
    return NextResponse.json({ error: 'manager_id и title обязательны' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('goals')
    .insert({ manager_id, parent_id, title: title.trim(), description, status, progress, order_index })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
