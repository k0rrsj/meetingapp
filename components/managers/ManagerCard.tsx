'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Calendar, Briefcase } from 'lucide-react';
import { formatShortDate } from '@/lib/utils';
import type { ManagerWithMetrics } from '@/types';

interface ManagerCardProps {
  manager: ManagerWithMetrics;
  companyId: string;
}

const WORK_TYPE_LABELS = {
  one_to_one: 'One-to-one',
  diagnostics: 'Диагностика',
};

export function ManagerCard({ manager, companyId }: ManagerCardProps) {
  return (
    <Link href={`/companies/${companyId}/managers/${manager.id}`}>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-1.5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base">{manager.name}</h3>
          <Badge
            variant={manager.status === 'in_progress' ? 'default' : 'secondary'}
            className="shrink-0 ml-2"
          >
            {manager.status === 'in_progress' ? 'В процессе' : 'Завершён'}
          </Badge>
        </div>

        {manager.position && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{manager.position}</p>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            {WORK_TYPE_LABELS[manager.work_type]}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {manager.meetings_count > 0
              ? `${manager.meetings_count} встреч${manager.last_meeting_date ? ` · ${formatShortDate(manager.last_meeting_date)}` : ''}`
              : 'Встреч нет'}
          </span>
        </div>
      </div>
    </Link>
  );
}
