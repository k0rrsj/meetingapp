import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AiSettingsForm } from '@/components/shared/AiSettingsForm';
import { ConsultantLibrary } from '@/components/shared/ConsultantLibrary';
import { AVAILABLE_MODELS } from '@/lib/openrouter/client';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'consultant') {
    redirect('/companies');
  }

  const { data: aiSettings } = await supabase
    .from('ai_settings')
    .select('preferred_model, telegram_chat_id')
    .eq('user_id', user.id)
    .single();

  const currentModel = aiSettings?.preferred_model ?? 'anthropic/claude-opus-4-5';

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Настройки AI</h1>
        <AiSettingsForm
          models={AVAILABLE_MODELS}
          currentModel={currentModel}
          currentTelegramChatId={aiSettings?.telegram_chat_id ?? null}
        />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
        <ConsultantLibrary />
      </div>
    </div>
  );
}
