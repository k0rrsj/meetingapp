import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const company_id = searchParams.get('company_id');
  const manager_id = searchParams.get('manager_id');

  if (!company_id && !manager_id) {
    return NextResponse.json({ error: 'Требуется company_id или manager_id' }, { status: 400 });
  }

  let query = supabase.from('documents').select('*').order('created_at', { ascending: true });

  if (company_id) query = query.eq('company_id', company_id);
  if (manager_id) query = query.eq('manager_id', manager_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await request.json();
  const { company_id, manager_id, title, content = '', type = 'other' } = body;

  if (!title) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
  if (!company_id && !manager_id) {
    return NextResponse.json({ error: 'Требуется company_id или manager_id' }, { status: 400 });
  }
  if (company_id && manager_id) {
    return NextResponse.json({ error: 'Укажите только один из: company_id или manager_id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({ company_id: company_id ?? null, manager_id: manager_id ?? null, title, content, type, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
