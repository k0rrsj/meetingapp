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

  if (profile?.role !== 'consultant' && profile?.role !== 'assistant') {
    redirect('/companies');
  }

  const { data: aiSettings } = await supabase
    .from('ai_settings')
    .select('preferred_model, scenario_model, analysis_model, chat_model, telegram_chat_id, meeting_reminder_enabled')
    .eq('user_id', user.id)
    .single();

  const defaultModel = aiSettings?.preferred_model ?? 'anthropic/claude-opus-4-5';

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Настройки AI</h1>
        <AiSettingsForm
          models={AVAILABLE_MODELS}
          currentScenarioModel={aiSettings?.scenario_model ?? defaultModel}
          currentAnalysisModel={aiSettings?.analysis_model ?? defaultModel}
          currentChatModel={aiSettings?.chat_model ?? defaultModel}
          currentTelegramChatId={aiSettings?.telegram_chat_id ?? null}
          currentReminderEnabled={aiSettings?.meeting_reminder_enabled ?? true}
        />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
        <ConsultantLibrary />
      </div>
    </div>
  );
}
