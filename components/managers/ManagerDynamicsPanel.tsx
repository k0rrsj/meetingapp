'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { DynamicsSnapshot, Meeting } from '@/types';

interface ManagerDynamicsPanelProps {
  managerId: string;
  meetings: Meeting[];
  initialSnapshot: DynamicsSnapshot | null;
  initialSnapshotUpdatedAt: string | null;
}

type InstallationSnapshot = { meetingNumber: number; thesis: string; status: string };
type PatternSnapshot = { meetingNumber: number; name: string; mechanics: string; status: string };
type CommitmentStatus = 'promised' | 'completed' | 'postponed' | 'ignored';
type CommitmentItem = {
  text: string;
  status: CommitmentStatus;
  sourceMeeting?: number;
  due?: string;
  comment?: string;
};
type DynamicsAiResult = DynamicsSnapshot;

function splitActionPlanLines(actionPlan: string | null): string[] {
  if (!actionPlan) return [];
  return actionPlan.split('\n').map((line) => line.trim()).filter(Boolean);
}

function detectStatus(line: string): CommitmentStatus {
  const lowered = line.toLowerCase();
  if (lowered.includes('сделан') || lowered.includes('выполн')) return 'completed';
  if (lowered.includes('перенес')) return 'postponed';
  if (lowered.includes('игнор')) return 'ignored';
  return 'promised';
}

function groupCommitments(items: CommitmentItem[]) {
  return {
    promised: items.filter((i) => i.status === 'promised'),
    completed: items.filter((i) => i.status === 'completed'),
    postponed: items.filter((i) => i.status === 'postponed'),
    ignored: items.filter((i) => i.status === 'ignored'),
  };
}

function installationStatusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case 'accepted_intellectually':
      return {
        label: 'Принята интеллектуально',
        className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      };
    case 'applied_in_action':
      return {
        label: 'Применяется в действии',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      };
    case 'normalized':
      return {
        label: 'Стала нормой',
        className: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      };
    case 'not_accepted':
      return {
        label: 'Не принята',
        className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      };
    default:
      return {
        label: status || '—',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      };
  }
}

function patternDynamicsMeta(status: string): { label: string; className: string } {
  switch (status) {
    case 'strengthened':
      return {
        label: 'Усилился',
        className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      };
    case 'weakened':
      return {
        label: 'Ослаб',
        className: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      };
    case 'counterexample':
      return {
        label: 'Контрпример',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      };
    case 'unchanged':
      return {
        label: 'Без изменений',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      };
    default:
      return {
        label: status || '—',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      };
  }
}

export function ManagerDynamicsPanel({
  managerId,
  meetings,
  initialSnapshot,
  initialSnapshotUpdatedAt,
}: ManagerDynamicsPanelProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<DynamicsAiResult | null>(initialSnapshot);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(initialSnapshotUpdatedAt);

  const ascMeetings = useMemo(() => [...meetings].sort((a, b) => a.meeting_number - b.meeting_number), [meetings]);

  const fallbackInstallations: InstallationSnapshot[] = [];
  const fallbackPatterns: PatternSnapshot[] = [];
  const fallbackCommitments: CommitmentItem[] = [];

  for (const meeting of ascMeetings) {
    const extension = meeting.diagnostic_extension;
    extension?.installations?.forEach((inst) => {
      fallbackInstallations.push({
        meetingNumber: meeting.meeting_number,
        thesis: inst.thesis,
        status: inst.follow_up_status ?? 'accepted_intellectually',
      });
    });

    extension?.behavior_patterns?.forEach((pattern) => {
      fallbackPatterns.push({
        meetingNumber: meeting.meeting_number,
        name: pattern.name,
        mechanics: pattern.mechanics,
        status: pattern.status,
      });
    });

    const structured = extension?.commitments?.map((item) => ({
      text: item.text,
      status: (item.status ?? 'promised') as CommitmentStatus,
      sourceMeeting: meeting.meeting_number,
      due: item.due,
    })) ?? [];

    if (structured.length > 0) {
      fallbackCommitments.push(...structured);
      continue;
    }

    for (const line of splitActionPlanLines(meeting.action_plan)) {
      fallbackCommitments.push({
        text: line,
        status: detectStatus(line),
        sourceMeeting: meeting.meeting_number,
      });
    }
  }

  const installationRows: InstallationSnapshot[] = aiResult?.installations?.length
    ? aiResult.installations.map((row, idx) => ({
        meetingNumber: row.meeting_number ?? idx + 1,
        thesis: row.thesis ?? '—',
        status: row.status ?? '—',
      }))
    : fallbackInstallations;

  const patternRows: PatternSnapshot[] = aiResult?.patterns?.length
    ? aiResult.patterns.map((row) => ({
        meetingNumber: 0,
        name: row.name ?? '—',
        mechanics: [row.mechanics, row.was && `было: ${row.was}`, row.became && `стало: ${row.became}`]
          .filter(Boolean)
          .join(' | '),
        status: row.dynamics ?? '—',
      }))
    : fallbackPatterns;

  const commitmentsList = aiResult?.commitments?.length ? aiResult.commitments : fallbackCommitments;
  const commitmentGroups = groupCommitments(commitmentsList);
  const summary = aiResult?.summary ?? {
    promised: commitmentGroups.promised.length,
    completed: commitmentGroups.completed.length,
    postponed: commitmentGroups.postponed.length,
    ignored: commitmentGroups.ignored.length,
  };

  async function handleAnalyzeAllMeetings() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/managers/${managerId}/dynamics/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка анализа динамики');
        return;
      }
      setAiResult(data as DynamicsAiResult);
      const persistedAt = (data as { persisted_at?: string }).persisted_at;
      setSnapshotUpdatedAt(persistedAt ?? new Date().toISOString());
      toast.success('Динамика обновлена на основе всех встреч');
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Межсессионная динамика</h3>
          {snapshotUpdatedAt ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Снимок в БД обновлён: {new Date(snapshotUpdatedAt).toLocaleString('ru-RU')}
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Снимок ещё не сохранён — нажмите «Проанализировать все встречи (ИИ)».
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-violet-600 hover:bg-violet-500 text-white"
          onClick={handleAnalyzeAllMeetings}
          disabled={analyzing}
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? 'Анализ...' : 'Проанализировать все встречи (ИИ)'}
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Статус установок</h4>
        {installationRows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Пока нет зафиксированных установок.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3">Встреча</th>
                  <th className="py-2 pr-3">Установка</th>
                  <th className="py-2">Статус</th>
                </tr>
              </thead>
              <tbody>
                {installationRows.map((row, idx) => (
                  <tr key={`${row.meetingNumber}-${idx}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3">№{row.meetingNumber}</td>
                    <td className="py-2 pr-3">{row.thesis}</td>
                    <td className="py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${installationStatusMeta(row.status).className}`}
                      >
                        {installationStatusMeta(row.status).label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Динамика паттернов</h4>
        {patternRows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Пока нет именованных паттернов.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-3">Встреча</th>
                  <th className="py-2 pr-3">Паттерн</th>
                  <th className="py-2 pr-3">Механика</th>
                  <th className="py-2">Статус</th>
                </tr>
              </thead>
              <tbody>
                {patternRows.map((row, idx) => (
                  <tr key={`${row.name}-${idx}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3">{row.meetingNumber > 0 ? `№${row.meetingNumber}` : '—'}</td>
                    <td className="py-2 pr-3">{row.name}</td>
                    <td className="py-2 pr-3">{row.mechanics}</td>
                    <td className="py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${patternDynamicsMeta(row.status).className}`}
                      >
                        {patternDynamicsMeta(row.status).label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Договорённости</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">Обещано: {summary.promised ?? 0}</div>
          <div className="rounded-lg bg-green-50 dark:bg-green-950/40 px-3 py-2">Выполнено: {summary.completed ?? 0}</div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2">Перенесено: {summary.postponed ?? 0}</div>
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2">Игнорировано: {summary.ignored ?? 0}</div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Обещано</p>
            {commitmentGroups.promised.length === 0 ? (
              <p className="text-xs text-gray-400">Нет пунктов</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {commitmentGroups.promised.map((item, idx) => (
                  <li key={`prom-${idx}`}>• {item.text}{item.sourceMeeting ? ` (встреча №${item.sourceMeeting})` : ''}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-green-200 dark:border-green-900 p-3">
            <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">Выполнено</p>
            {commitmentGroups.completed.length === 0 ? (
              <p className="text-xs text-gray-400">Нет пунктов</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {commitmentGroups.completed.map((item, idx) => (
                  <li key={`done-${idx}`}>• {item.text}{item.sourceMeeting ? ` (встреча №${item.sourceMeeting})` : ''}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 p-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">Перенесено</p>
            {commitmentGroups.postponed.length === 0 ? (
              <p className="text-xs text-gray-400">Нет пунктов</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {commitmentGroups.postponed.map((item, idx) => (
                  <li key={`post-${idx}`}>• {item.text}{item.sourceMeeting ? ` (встреча №${item.sourceMeeting})` : ''}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-red-200 dark:border-red-900 p-3">
            <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">Игнорировано</p>
            {commitmentGroups.ignored.length === 0 ? (
              <p className="text-xs text-gray-400">Нет пунктов</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {commitmentGroups.ignored.map((item, idx) => (
                  <li key={`ign-${idx}`}>• {item.text}{item.sourceMeeting ? ` (встреча №${item.sourceMeeting})` : ''}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
