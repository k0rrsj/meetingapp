import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callOpenRouter } from '@/lib/openrouter/client';
import { buildAgentSystemPrompt } from '@/lib/prompts/agent';
import { fetchCompanyDocs } from '@/lib/context/company-docs';

const CHAT_HISTORY_LIMIT = 20;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { manager_id, message } = await request.json();
  if (!manager_id || !message?.trim()) {
    return NextResponse.json({ error: 'manager_id и message обязательны' }, { status: 400 });
  }

  const { data: managerData } = await supabase
    .from('managers')
    .select('*, company:companies(id)')
    .eq('id', manager_id)
    .single();

  if (!managerData) {
    return NextResponse.json({ error: 'Руководитель не найден' }, { status: 404 });
  }

  const manager = managerData;
  const companyId = manager.company?.id ?? null;

  const [aiSettingsResult, trackResult, consultantDocsResult, chatHistoryResult, companyDocs] = await Promise.all([
    supabase.from('ai_settings').select('preferred_model').eq('user_id', user.id).single(),
    supabase.from('documents').select('content').eq('manager_id', manager_id).eq('type', 'track').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('consultant_documents').select('title, content').eq('user_id', user.id).eq('is_active', true).order('created_at'),
    supabase.from('manager_chat_messages').select('role, content').eq('manager_id', manager_id).order('created_at', { ascending: false }).limit(CHAT_HISTORY_LIMIT),
    companyId ? fetchCompanyDocs(supabase, companyId) : Promise.resolve([]),
  ]);

  const systemPrompt = buildAgentSystemPrompt({
    manager,
    trackContent: trackResult.data?.content ?? null,
    consultantDocs: consultantDocsResult.data ?? null,
    companyDocs,
  });

  const model = aiSettingsResult.data?.preferred_model ?? 'anthropic/claude-opus-4-5';

  // Build messages: history (oldest first) + new user message
  const history = (chatHistoryResult.data ?? []).reverse();
  const messages = [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message.trim() },
  ];

  // Save user message
  await supabase.from('manager_chat_messages').insert({
    manager_id,
    role: 'user',
    content: message.trim(),
  });

  try {
    const reply = await callOpenRouter({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1500,
      temperature: 0.7,
    });

    // Save assistant reply
    await supabase.from('manager_chat_messages').insert({
      manager_id,
      role: 'assistant',
      content: reply,
    });

    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Сервис AI временно недоступен';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const manager_id = searchParams.get('manager_id');
  if (!manager_id) return NextResponse.json({ error: 'manager_id обязателен' }, { status: 400 });

  const { data, error } = await supabase
    .from('manager_chat_messages')
    .select('*')
    .eq('manager_id', manager_id)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
