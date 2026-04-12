'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { DocumentEditor } from '@/components/documents/DocumentEditor';
import { Download, Pencil, Loader2, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Document, UserRole } from '@/types';
import { isStructuredTrackContent } from '@/lib/track/section-ids';

interface ManagerTrackPanelProps {
  managerId: string;
  managerName: string;
  userRole: UserRole;
}

function slugifyFilename(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Zа-яА-ЯёЁ0-9\-_.]/g, '')
    .slice(0, 80) || 'track';
}

export function ManagerTrackPanel({ managerId, managerName, userRole }: ManagerTrackPanelProps) {
  const [trackDoc, setTrackDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/managers/${managerId}/track/ensure`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Не удалось загрузить трек');
        setTrackDoc(null);
        return;
      }
      setTrackDoc(data.document as Document);
      if (data.created) {
        toast.success('Создан документ трека по шаблону v1');
      }
    } catch {
      toast.error('Ошибка соединения');
      setTrackDoc(null);
    } finally {
      setLoading(false);
    }
  }, [managerId]);

  useEffect(() => {
    load();
  }, [load]);

  const structured = trackDoc ? isStructuredTrackContent(trackDoc.content) : false;

  async function handleSynthesizeFromMeetings() {
    if (
      !confirm(
        'ИИ заполнит все разделы трека по материалам встреч (проведённые / обработанные / закрытые) и карточке руководителя. Текущий текст трека сохранится в истории версий. Продолжить?'
      )
    ) {
      return;
    }
    setSynthesizing(true);
    try {
      const res = await fetch(`/api/managers/${managerId}/track/synthesize-from-meetings`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка генерации', {
          description: data.code === 'NO_MEETINGS' ? 'Заполните расшифровки или поля анализа у встреч.' : undefined,
        });
        return;
      }
      if (data.document) setTrackDoc(data.document as Document);
      else await load();
      toast.success('Трек заполнен по архиву встреч');
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSynthesizing(false);
    }
  }

  async function handleMigrateV1() {
    if (!confirm('Текущее содержимое трека будет сохранено в истории версий и заменено шаблоном v1. Продолжить?')) {
      return;
    }
    setMigrating(true);
    try {
      const res = await fetch(`/api/managers/${managerId}/track/migrate-v1`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка');
        return;
      }
      setTrackDoc(data.document as Document);
      toast.success('Установлен шаблон трека v1');
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setMigrating(false);
    }
  }

  function handleExportMd() {
    if (!trackDoc?.content) return;
    const safe = slugifyFilename(managerName);
    const date = format(new Date(), 'yyyy-MM-dd');
    const blob = new Blob([trackDoc.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(window.document.createElement('a'), {
      href: url,
      download: `трек-${safe}-${date}.md`,
    });
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Файл скачан');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Загрузка трека…
      </div>
    );
  }

  if (!trackDoc) {
    return (
      <div className="text-sm text-gray-500 py-8 text-center">
        Не удалось загрузить трек.{' '}
        <Button variant="link" className="p-0 h-auto" onClick={() => load()}>
          Повторить
        </Button>
      </div>
    );
  }

  const canEdit = userRole === 'assistant';

  return (
    <div className="space-y-4">
      {!structured && (
        <div className="flex gap-3 items-start rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-100">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Документ не в формате v1</p>
            <p className="text-amber-800 dark:text-amber-200/90 mt-1">
              Автообновление трека при закрытии встречи работает только для структурированного шаблона (11 разделов с
              маркерами). Установите шаблон — текущий текст уйдёт в историю версий.
            </p>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-amber-300 text-amber-900"
                disabled={migrating}
                onClick={handleMigrateV1}
              >
                {migrating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Установить шаблон v1
              </Button>
            ) : (
              <p className="text-xs text-amber-800 dark:text-amber-200/90 mt-2">
                Установить шаблон может ассистент.
              </p>
            )}
          </div>
        </div>
      )}

      {structured && (
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          Шаблон v1 изначально только задаёт структуру разделов. Развёрнутый текст появляется после закрытия встреч
          (автосинхрон) или здесь — кнопка «Заполнить трек из встреч»: ИИ соберёт архив всех встреч с материалами и
          карточку руководителя в один проход, как у консультанта.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && structured && (
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-violet-600 hover:bg-violet-500 text-white"
            disabled={synthesizing}
            onClick={handleSynthesizeFromMeetings}
          >
            {synthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {synthesizing ? 'Генерация…' : 'Заполнить трек из встреч (ИИ)'}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={handleExportMd} className="gap-1.5">
          <Download className="w-4 h-4" />
          Скачать .md
        </Button>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => setEditorOpen(true)} className="gap-1.5">
            <Pencil className="w-4 h-4" />
            Редактировать
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => load()}>
          Обновить из сервера
        </Button>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-950 min-h-[320px]">
        {trackDoc.content ? (
          <ReactMarkdown>{trackDoc.content}</ReactMarkdown>
        ) : (
          <p className="text-gray-400 italic text-sm">Пусто</p>
        )}
      </div>

      {editorOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          role="presentation"
          onClick={() => setEditorOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto p-6 shadow-xl border border-gray-200 dark:border-gray-800"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <DocumentEditor
              document={trackDoc}
              onUpdate={(d) => {
                setTrackDoc(d);
                setEditorOpen(false);
              }}
              onClose={() => setEditorOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
