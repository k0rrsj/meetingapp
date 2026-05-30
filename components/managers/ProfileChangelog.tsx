'use client';

import { useEffect, useState } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import type { LeaderProfileChangeWithMeeting } from '@/types';

interface ProfileChangelogProps {
  managerId: string;
  /** Changing this re-fetches (e.g. manager.updated_at after a meeting closes). */
  refreshKey?: string | null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function ProfileChangelog({ managerId, refreshKey }: ProfileChangelogProps) {
  const [changes, setChanges] = useState<LeaderProfileChangeWithMeeting[]>([]);
  const [latestMeetingNumber, setLatestMeetingNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/managers/${managerId}/profile-changes`)
      .then((res) => (res.ok ? res.json() : { changes: [], latest_meeting_number: null }))
      .then((data) => {
        if (!active) return;
        setChanges(data.changes ?? []);
        setLatestMeetingNumber(data.latest_meeting_number ?? null);
      })
      .catch(() => {
        if (active) setChanges([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [managerId, refreshKey]);

  if (loading) {
    return <div className="h-4 w-40 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />;
  }

  const hasChanges = changes.length > 0;

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
        <Sparkles className="w-3 h-3 text-violet-400" />
        {latestMeetingNumber != null ? (
          <span>
            Профиль обновлён после встречи{' '}
            <span className="font-medium text-gray-500 dark:text-gray-400">№{latestMeetingNumber}</span>
          </span>
        ) : (
          <span>Живой профиль · обновляется из встреч</span>
        )}
      </div>

      {hasChanges ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors select-none">
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
            Что изменилось
          </summary>
          <ul className="mt-1.5 space-y-1 pl-4">
            {changes.map((change) => (
              <li key={change.id} className="flex items-baseline gap-1.5 text-gray-500 dark:text-gray-400">
                <span className="text-violet-300 dark:text-violet-500">•</span>
                <span className="flex-1 leading-relaxed">
                  {change.summary}
                  {change.meeting_number != null && (
                    <span className="text-gray-300 dark:text-gray-600"> · №{change.meeting_number}</span>
                  )}
                </span>
                <span className="shrink-0 text-gray-300 dark:text-gray-600">{formatDate(change.created_at)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="italic text-gray-400 dark:text-gray-500">
          История изменений появится после следующего AI-анализа.
        </p>
      )}
    </div>
  );
}
