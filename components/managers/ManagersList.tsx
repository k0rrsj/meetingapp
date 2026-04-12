'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { AddManagerDialog } from '@/components/managers/AddManagerDialog';
import { UserCircle, Calendar, Briefcase, Trash2, Loader2 } from 'lucide-react';
import { formatShortDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { ManagerWithMetrics, UserRole } from '@/types';

interface ManagersListProps {
  managers: ManagerWithMetrics[];
  companyId: string;
  userRole: UserRole;
}

const WORK_TYPE_LABELS = {
  one_to_one: 'One-to-one',
  diagnostics: 'Диагностика',
};

export function ManagersList({ managers: initialManagers, companyId, userRole }: ManagersListProps) {
  const router = useRouter();
  const [managers, setManagers] = useState(initialManagers);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const isAssistant = userRole === 'assistant';

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/managers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setManagers((prev) => prev.filter((m) => m.id !== id));
        setConfirmId(null);
        toast.success('Руководитель удалён');
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка удаления');
        setConfirmId(null);
      }
    } catch {
      toast.error('Ошибка соединения');
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  }

  function cancelConfirm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmId(null);
  }

  if (managers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <UserCircle className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4" />
        <h3 className="text-gray-600 dark:text-gray-400 font-medium mb-1">Нет руководителей</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          {isAssistant ? 'Добавьте первого руководителя' : 'Руководители появятся здесь после добавления'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {managers.map((manager) => (
        <div key={manager.id} className="relative group">
          <Link href={`/companies/${companyId}/managers/${manager.id}`}>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-1.5">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base pr-2">{manager.name}</h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant={manager.status === 'in_progress' ? 'default' : 'secondary'}>
                    {manager.status === 'in_progress' ? 'В процессе' : 'Завершён'}
                  </Badge>
                </div>
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

          {isAssistant && (
            <div
              className="absolute bottom-3 right-3 flex items-center gap-1"
              onClick={(e) => e.preventDefault()}
            >
              {confirmId === manager.id ? (
                <>
                  <button
                    className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded"
                    onClick={(e) => handleDelete(manager.id, e)}
                    disabled={deletingId === manager.id}
                  >
                    {deletingId === manager.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Да, удалить'
                    )}
                  </button>
                  <button
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded"
                    onClick={cancelConfirm}
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm"
                  onClick={(e) => handleDelete(manager.id, e)}
                  title="Удалить руководителя"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
