import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { synthesizeTrackFromMeetingsHistory } from '@/lib/track/synthesize-from-meetings';

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
    return NextResponse.json({ error: 'Только ассистент может запускать полную генерацию трека' }, { status: 403 });
  }

  const result = await synthesizeTrackFromMeetingsHistory(supabase, {
    managerId,
    actingUserId: user.id,
  });

  if (!result.ok) {
    const status =
      result.code === 'NOT_STRUCTURED'
        ? 409
        : result.code === 'NO_MEETINGS'
          ? 422
          : 502;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  const { data: doc } = await supabase.from('documents').select('*').eq('id', result.document_id).single();

  return NextResponse.json({ document: doc, document_id: result.document_id });
}
