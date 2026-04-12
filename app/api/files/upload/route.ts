import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'assistant') {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const meetingId = formData.get('meeting_id') as string | null;

  if (!file || !meetingId) {
    return NextResponse.json({ error: 'file и meeting_id обязательны' }, { status: 400 });
  }

  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: 'Файл слишком большой (макс. 10 МБ)' },
      { status: 400 }
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['txt', 'docx'].includes(ext ?? '')) {
    return NextResponse.json(
      { error: 'Поддерживаются только .txt и .docx' },
      { status: 400 }
    );
  }

  const { data: meeting } = await supabase
    .from('meetings')
    .select('manager_id')
    .eq('id', meetingId)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: 'Встреча не найдена' }, { status: 404 });
  }

  const storagePath = `${meeting.manager_id}/${meetingId}/transcription.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('transcriptions')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from('transcriptions')
    .getPublicUrl(storagePath);

  // Extract text
  let extractedText = '';
  try {
    if (ext === 'txt') {
      extractedText = buffer.toString('utf-8');
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }
  } catch {
    return NextResponse.json(
      { error: 'Не удалось прочитать файл. Попробуйте экспортировать в .txt' },
      { status: 400 }
    );
  }

  // Save to meeting
  await supabase
    .from('meetings')
    .update({
      transcription_file_url: urlData.publicUrl,
      transcription_text: extractedText,
    })
    .eq('id', meetingId);

  return NextResponse.json({
    file_url: urlData.publicUrl,
    transcription_text: extractedText,
    text_preview: extractedText.substring(0, 200),
    chars_count: extractedText.length,
  });
}
