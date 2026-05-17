import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string; problemId: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { problemId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const body = await req.json();
  const allowed: Record<string, unknown> = {};

  if (typeof body.status === 'string' && ['active', 'resolved'].includes(body.status)) {
    allowed.status = body.status;
    if (body.status === 'resolved') {
      allowed.resolved_meeting_id = body.resolved_meeting_id ?? null;
    }
  }
  if (typeof body.text === 'string' && body.text.trim()) {
    allowed.text = body.text.trim();
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'Нет допустимых полей для обновления' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('manager_problems')
    .update(allowed)
    .eq('id', problemId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { problemId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { error } = await supabase
    .from('manager_problems')
    .delete()
    .eq('id', problemId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
