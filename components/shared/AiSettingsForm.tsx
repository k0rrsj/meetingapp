'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { AvailableModel } from '@/types';

interface AiSettingsFormProps {
  models: AvailableModel[];
  currentModel: string;
  currentTelegramChatId: string | null;
}

const MODEL_PRICES: Record<string, string> = {
  'openai/gpt-4o': '~$0.006/запрос',
  'openai/gpt-4o-mini': '~$0.001/запрос',
  'anthropic/claude-3.7-sonnet': '~$0.009/запрос',
  'google/gemini-pro-1.5': '~$0.004/запрос',
};

export function AiSettingsForm({ models, currentModel, currentTelegramChatId }: AiSettingsFormProps) {
  const [selected, setSelected] = useState(currentModel);
  const [telegramChatId, setTelegramChatId] = useState(currentTelegramChatId ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_model: selected, telegram_chat_id: telegramChatId.trim() || null }),
      });

      if (res.ok) {
        toast.success('Настройки сохранены');
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка сохранения');
      }
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
      <div>
        <Label className="text-sm font-semibold text-gray-700 mb-3 block">Выбор модели AI</Label>
        <div className="space-y-2">
          {models.map((model) => (
            <label
              key={model.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                selected === model.id
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={selected === model.id}
                  onChange={() => setSelected(model.id)}
                  className="text-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{model.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Контекст: {(model.context_length / 1000).toFixed(0)}k токенов
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-500">{MODEL_PRICES[model.id] ?? ''}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="telegram-chat-id" className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Telegram chat ID
        </Label>
        <Input
          id="telegram-chat-id"
          value={telegramChatId}
          onChange={(e) => setTelegramChatId(e.target.value)}
          placeholder="Например: 123456789"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Нужен для кнопки «Отправить в Telegram». Откройте вашего бота в Telegram, отправьте /start и получите chat ID через @userinfobot.
        </p>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Сохраняю...' : 'Сохранить'}
      </Button>
    </div>
  );
}
