import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name, role')
    .eq('id', data.user.id)
    .single();

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role: profile?.role ?? data.user.user_metadata?.role ?? 'assistant',
      name: profile?.name ?? data.user.user_metadata?.name ?? data.user.email,
    },
  });
}
