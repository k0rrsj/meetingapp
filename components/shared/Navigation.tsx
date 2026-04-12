'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brain, LogOut, Settings, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import type { UserProfile } from '@/types';

interface NavigationProps {
  user: UserProfile;
}

export function Navigation({ user }: NavigationProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/companies" className="flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">Meeting Intelligence</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {user.name}
            <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
              ({user.role === 'consultant' ? 'Консультант' : 'Ассистент'})
            </span>
          </span>

          {user.role === 'consultant' && (
            <Link href="/settings" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors">
              <Settings className="w-4 h-4" />
            </Link>
          )}

          <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {mounted && (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
          </Button>

          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
