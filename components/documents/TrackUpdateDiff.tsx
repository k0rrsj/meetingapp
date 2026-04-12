'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, ChevronDown, ChevronUp, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TrackAddition {
  section: string;
  content: string;
  type: string;
}

interface ActionItem {
  what: string;
  deadline: string;
  report_format: string;
}

interface MentionedPerson {
  name: string;
  is_new: boolean;
  delta: string;
}

interface TrackAnalysis {
  summary: string;
  additions: TrackAddition[];
  new_action_items: ActionItem[];
  mentioned_people: MentionedPerson[];
}

interface TrackUpdateDiffProps {
  meetingId: string;
  managerId: string;
  managerName: string;
  onApplied?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  pattern: 'Паттерн',
  shift: 'Сдвиг восприятия',
  action: 'Действие',
  person: 'Человек',
  note: 'Заметка',
};

const TYPE_COLORS: Record<string, string> = {
  pattern: 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
  shift: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  action: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:text-green-300',
  person: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300',
  note: 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export function TrackUpdateDiff({ meetingId, managerId, managerName, onApplied }: TrackUpdateDiffProps) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [analysis, setAnalysis] = useState<TrackAnalysis | null>(null);
  const [trackDocId, setTrackDocId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  async function handleAnalyze() {
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch('/api/ai/update-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка анализа');
        return;
      }
      setAnalysis(data.analysis as TrackAnalysis);
      setTrackDocId(data.track_document_id);
      setCurrentContent(data.current_track_content ?? '');
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!analysis) return;
    setApplying(true);

    const today = format(new Date(), 'd MMMM yyyy', { locale: ru });
    const additionsText = analysis.additions
      .map((a) => `\n### [${today}] ${a.section}\n${a.content}`)
      .join('\n');

    const newActionItems = analysis.new_action_items.length > 0
      ? `\n### [${today}] Приоритеты действий\n` + analysis.new_action_items
          .map((item) => `- ${item.what} | до ${item.deadline} | отчёт: ${item.report_format}`)
          .join('\n')
      : '';

    const newPeopleSection = analysis.mentioned_people.filter(p => p.is_new).length > 0
      ? `\n### [${today}] Новые участники\n` + analysis.mentioned_people
          .filter(p => p.is_new)
          .map((p) => `- ${p.name}: ${p.delta}`)
          .join('\n')
      : '';

    const appendix = additionsText + newActionItems + newPeopleSection;
    const updatedContent = currentContent
      ? currentContent + '\n\n---\n' + appendix
      : `# Трек развития — ${managerName}\n` + appendix;

    try {
      if (trackDocId) {
        const res = await fetch(`/api/documents/${trackDocId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: updatedContent }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error ?? 'Ошибка сохранения трека');
          return;
        }
      } else {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manager_id: managerId,
            title: `Трек развития — ${managerName}`,
            type: 'track',
            content: updatedContent,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error ?? 'Ошибка создания трека');
          return;
        }
      }

      // Send Telegram notification
      await fetch('/api/telegram/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_name: managerName,
          summary: analysis.summary,
          action_items: analysis.new_action_items,
        }),
      }).catch(() => {}); // non-blocking

      toast.success('Трек обновлён');
      setAnalysis(null);
      onApplied?.();
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setApplying(false);
    }
  }

  function toggleItem(i: number) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        При переводе встречи в статус «Закрыта» трек в формате v1 на вкладке «Трек» руководителя обновляется автоматически
        (слияние по разделам). Кнопка ниже — прежний ручной режим: ИИ предлагает блоки для дописывания в конец документа;
        используйте осознанно, чтобы не дублировать автоматические записи.
      </p>
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={handleAnalyze}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Анализирую расшифровку...' : 'Обновить трек по расшифровке'}
      </Button>

      {analysis && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {/* Summary */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Резюме сессии</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.summary}</p>
          </div>

          {/* Additions */}
          {analysis.additions.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {analysis.additions.map((addition, i) => (
                <div key={i} className="px-4 py-3">
                  <div
                    className="flex items-start justify-between gap-2 cursor-pointer"
                    onClick={() => toggleItem(i)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Plus className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium shrink-0 ${TYPE_COLORS[addition.type] ?? TYPE_COLORS.note}`}>
                        {TYPE_LABELS[addition.type] ?? addition.type}
                      </span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {addition.section}
                      </span>
                    </div>
                    {expandedItems.has(i)
                      ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    }
                  </div>
                  {expandedItems.has(i) && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap pl-6">
                      {addition.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Action items */}
          {analysis.new_action_items.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-green-50/50 dark:bg-green-950/10">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Новые договорённости</p>
              <div className="space-y-1.5">
                {analysis.new_action_items.map((item, i) => (
                  <div key={i} className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{item.what}</span>
                    <span className="text-gray-400"> · до {item.deadline} · {item.report_format}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mentioned people */}
          {analysis.mentioned_people.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Упомянутые люди</p>
              <div className="space-y-1">
                {analysis.mentioned_people.map((person, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {person.is_new && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium shrink-0">
                        Новый
                      </span>
                    )}
                    <span className="font-medium text-gray-800 dark:text-gray-200">{person.name}:</span>
                    <span className="text-gray-600 dark:text-gray-400">{person.delta}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Apply button */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <Button
              className="w-full gap-2 bg-green-600 hover:bg-green-500 text-white"
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {applying ? 'Применяю...' : 'Применить обновление трека'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
