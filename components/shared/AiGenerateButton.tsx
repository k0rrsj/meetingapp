'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AiGenerateButtonProps {
  endpoint: string;
  meetingId: string;
  onSuccess: (result: string) => void;
  label?: string;
  disabled?: boolean;
}

export function AiGenerateButton({
  endpoint,
  meetingId,
  onSuccess,
  label = 'Сгенерировать',
  disabled = false,
}: AiGenerateButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка генерации');
        return;
      }

      const result = data.scenario ?? data.transcription_prompt ?? data.next_scenario;
      if (result) {
        onSuccess(result);
        toast.success('Сгенерировано успешно');
      } else {
        toast.error('AI не вернул результат');
      }
    } catch {
      toast.error('Ошибка соединения с AI');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleGenerate}
      disabled={disabled || loading}
      className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Sparkles className="w-3.5 h-3.5" />
      )}
      {loading ? 'Генерирую...' : label}
    </Button>
  );
}
