'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Calendar } from 'lucide-react';
import { formatShortDate } from '@/lib/utils';
import type { CompanyWithMetrics } from '@/types';

interface CompanyCardProps {
  company: CompanyWithMetrics;
}

export function CompanyCard({ company }: CompanyCardProps) {
  const progress =
    company.total_meetings_count > 0
      ? Math.round((company.closed_meetings_count / company.total_meetings_count) * 100)
      : 0;

  return (
    <Link href={`/companies/${company.id}/managers`}>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">{company.name}</h3>
          <Badge
            variant={company.status === 'active' ? 'default' : 'secondary'}
            className="shrink-0 ml-2"
          >
            {company.status === 'active' ? 'Активна' : 'Завершена'}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {company.active_managers_count} руководителей
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {company.last_meeting_date
              ? `Последняя: ${formatShortDate(company.last_meeting_date)}`
              : 'Встреч нет'}
          </span>
        </div>

        {company.total_meetings_count > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Прогресс встреч</span>
              <span>{company.closed_meetings_count}/{company.total_meetings_count} закрыто</span>
            </div>
            <Progress value={progress} aria-valuetext={`${progress}%`} className="h-1.5" />
          </div>
        )}

        {company.total_meetings_count === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Встреч ещё нет</p>
        )}
      </div>
    </Link>
  );
}
