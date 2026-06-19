'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Dashboard-scoped error boundary. Keeps the top navigation in place (it lives
 * in the layout above this boundary) so a crash inside one screen doesn't take
 * down the whole workspace — the user can recover in context.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ui] dashboard error:', error?.message, error?.digest);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Не удалось отобразить раздел</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm">
        Произошла ошибка при загрузке этого экрана. Данные не потеряны — попробуйте повторить.
      </p>
      <Button onClick={reset} className="gap-2 mt-6">
        <RotateCcw className="w-4 h-4" />
        Повторить
      </Button>
    </div>
  );
}
