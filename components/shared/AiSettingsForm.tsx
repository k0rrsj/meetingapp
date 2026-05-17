'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { AvailableModel } from '@/types';

interface AiSettingsFormProps {
  models: AvailableModel[];
  currentScenarioModel: string;
  currentAnalysisModel: string;
  currentChatModel: string;
  currentTelegramChatId: string | null;
  currentReminderEnabled: boolean;
}

const MODEL_PRICES: Record<string, string> = {
  'anthropic/claude-opus-4-5': '~$0.015/запрос',
  'anthropic/claude-sonnet-4.5': '~$0.006/запрос',
  'anthropic/claude-3.7-sonnet': '~$0.006/запрос',
};

const TASK_LABELS: { key: 'scenario' | 'analysis' | 'chat'; label: string; hint: string }[] = [
  {
    key: 'scenario',
    label: 'Генерация сценария',
    hint: 'Используется при нажатии «Сгенерировать сценарий». Рекомендуется мощная модель.',
  },
  {
    key: 'analysis',
    label: 'Анализ расшифровки',
    hint: 'Используется для AI-разбора расшифровок. Достаточно средней модели.',
  },
  {
    key: 'chat',
    label: 'Чат с AI-агентом',
    hint: 'Используется в диалоге на вкладке «Чат с AI». Рекомендуется мощная модель.',
  },
];

function ModelPicker({
  label,
  hint,
  models,
  selected,
  onChange,
  name,
}: {
  label: string;
  hint: string;
  models: AvailableModel[];
  selected: string;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>
      </div>
      <div className="space-y-1.5">
        {models.map((model) => (
          <label
            key={model.id}
            className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
              selected === model.id
                ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <input
                type="radio"
                name={name}
                value={model.id}
                checked={selected === model.id}
                onChange={() => onChange(model.id)}
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
  );
}

export function AiSettingsForm({
  models,
  currentScenarioModel,
  currentAnalysisModel,
  currentChatModel,
  currentTelegramChatId,
  currentReminderEnabled,
}: AiSettingsFormProps) {
  const [scenarioModel, setScenarioModel] = useState(currentScenarioModel);
  const [analysisModel, setAnalysisModel] = useState(currentAnalysisModel);
  const [chatModel, setChatModel] = useState(currentChatModel);
  const [telegramChatId, setTelegramChatId] = useState(currentTelegramChatId ?? '');
  const [reminderEnabled, setReminderEnabled] = useState(currentReminderEnabled);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_model: scenarioModel,
          scenario_model: scenarioModel,
          analysis_model: analysisModel,
          chat_model: chatModel,
          telegram_chat_id: telegramChatId.trim() || null,
          meeting_reminder_enabled: reminderEnabled,
        }),
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

  const modelSetters = {
    scenario: setScenarioModel,
    analysis: setAnalysisModel,
    chat: setChatModel,
  };

  const modelValues = {
    scenario: scenarioModel,
    analysis: analysisModel,
    chat: chatModel,
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
      <div className="space-y-5">
        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200 block">
          Модели AI по задачам
        </Label>
        {TASK_LABELS.map(({ key, label, hint }) => (
          <ModelPicker
            key={key}
            name={`model-${key}`}
            label={label}
            hint={hint}
            models={models}
            selected={modelValues[key]}
            onChange={modelSetters[key]}
          />
        ))}
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4">
        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200 block">
          Telegram
        </Label>

        <div className="space-y-2">
          <Label htmlFor="telegram-chat-id" className="text-xs text-gray-500 dark:text-gray-400">
            Chat ID
          </Label>
          <Input
            id="telegram-chat-id"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="Например: 123456789"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            Нужен для кнопки «Отправить в Telegram» и уведомлений. Откройте бота, отправьте /start и получите ID через @userinfobot.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Уведомление накануне встречи
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Список активных проблем с inline-кнопками для закрытия
            </p>
          </div>
          <button
            role="switch"
            aria-checked={reminderEnabled}
            onClick={() => setReminderEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              reminderEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                reminderEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Сохраняю...' : 'Сохранить'}
      </Button>
    </div>
  );
}
