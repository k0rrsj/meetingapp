'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, MessageSquare, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { InterimEvent, UserRole } from '@/types';

interface InterimEventsProps {
  managerId: string;
  userRole: UserRole;
}

const SOURCE_LABELS = {
  app: 'Приложение',
  telegram: 'Telegram',
};

const SOURCE_COLORS = {
  app: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  telegram: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
};

export function InterimEvents({ managerId, userRole }: InterimEventsProps) {
  const [events, setEvents] = useState<InterimEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, [managerId]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await fetch(`/api/interim-events?manager_id=${managerId}`);
      if (res.ok) setEvents(await res.json());
    } catch {
      toast.error('Ошибка загрузки событий');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/interim-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: managerId, text: text.trim(), source: 'app' }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка сохранения');
        return;
      }
      const created: InterimEvent = await res.json();
      setEvents((prev) => [created, ...prev]);
      setText('');
      setAdding(false);
      toast.success('Событие добавлено');
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/interim-events/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Ошибка удаления');
        return;
      }
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setConfirmDelete(null);
      toast.success('Событие удалено');
    } catch {
      toast.error('Ошибка соединения');
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Промежуточные события</h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Добавить
          </Button>
        )}
      </div>

      {adding && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Опишите событие между встречами..."
            rows={3}
            autoFocus
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !text.trim()}>
              <Send className="w-3.5 h-3.5 mr-1" />
              {saving ? 'Сохраняю...' : 'Добавить'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setText(''); }}>
              <X className="w-3.5 h-3.5" />
              Отмена
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-6">Загрузка...</div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Событий нет</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Добавляйте заметки о том, что происходит между встречами
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="group flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SOURCE_COLORS[event.source]}`}>
                    {SOURCE_LABELS[event.source]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(event.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.text}</p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {confirmDelete === event.id ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-xs"
                      onClick={() => handleDelete(event.id)}
                    >
                      Удалить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6"
                      onClick={() => setConfirmDelete(null)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => setConfirmDelete(event.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
