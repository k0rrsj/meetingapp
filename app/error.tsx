'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Root error boundary. Catches any uncaught render/runtime error anywhere in
 * the app and shows a calm, recoverable screen instead of a blank white page.
 * This is the last-resort safety net behind the AI pipeline guards.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ui] unhandled error:', error?.message, error?.digest);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Что-то пошло не так</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Произошла непредвиденная ошибка. Ваши данные сохранены — попробуйте повторить действие.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button onClick={reset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Повторить
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/companies')}>
            На главную
          </Button>
        </div>
      </div>
    </div>
  );
}
