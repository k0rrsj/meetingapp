'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Plus, X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ManagerProblem } from '@/types';

interface ManagerProblemsPanelProps {
  managerId: string;
}

export function ManagerProblemsPanel({ managerId }: ManagerProblemsPanelProps) {
  const [problems, setProblems] = useState<ManagerProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    fetchProblems();
  }, [managerId]);

  async function fetchProblems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/managers/${managerId}/problems`);
      if (res.ok) setProblems(await res.json());
    } catch {
      toast.error('Ошибка загрузки проблем');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/managers/${managerId}/problems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка сохранения');
        return;
      }
      const created: ManagerProblem = await res.json();
      setProblems((prev) => [...prev, created]);
      setNewText('');
      setAdding(false);
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  }

  async function handleResolve(problem: ManagerProblem) {
    setResolving(problem.id);
    try {
      const res = await fetch(`/api/managers/${managerId}/problems/${problem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      if (!res.ok) {
        toast.error('Ошибка обновления');
        return;
      }
      const updated: ManagerProblem = await res.json();
      setProblems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setResolving(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/managers/${managerId}/problems/${id}`, { method: 'DELETE' });
      setProblems((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error('Ошибка удаления');
    }
  }

  const active = problems.filter((p) => p.status === 'active');
  const resolved = problems.filter((p) => p.status === 'resolved');

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Загрузка проблем...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
            Проблемы и сигналы
          </span>
          {active.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded-full px-1.5 py-0.5 font-medium">
              {active.length}
            </span>
          )}
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-0.5 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Добавить
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="flex items-center gap-1.5">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAdding(false); setNewText(''); }
            }}
            placeholder="Описание проблемы..."
            className="h-7 text-xs flex-1"
            autoFocus
          />
          <Button size="sm" className="h-7 w-7 p-0" onClick={handleAdd} disabled={saving || !newText.trim()}>
            <Check className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setAdding(false); setNewText(''); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Active problems */}
      {active.length === 0 && !adding && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Нет активных проблем</p>
      )}

      <div className="space-y-1">
        {active.map((problem) => (
          <div
            key={problem.id}
            className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
          >
            <span className="text-amber-400 mt-0.5 shrink-0 text-xs">•</span>
            <p className="text-xs text-gray-700 dark:text-gray-300 flex-1 leading-relaxed">
              {problem.text}
              <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                · {problem.meeting_count} {meetingWord(problem.meeting_count)}
              </span>
            </p>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => handleResolve(problem)}
                disabled={resolving === problem.id}
                title="Отметить решённой"
                className="p-1 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded transition-colors"
              >
                {resolving === problem.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Check className="w-3 h-3" />
                }
              </button>
              <button
                onClick={() => handleDelete(problem.id)}
                title="Удалить"
                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {/* Resolved problems */}
        {resolved.map((problem) => (
          <div
            key={problem.id}
            className="group flex items-start gap-2 rounded-md px-2 py-1 opacity-50 hover:opacity-70 transition-opacity"
          >
            <span className="text-gray-300 mt-0.5 shrink-0 text-xs">•</span>
            <p className="text-xs text-gray-400 dark:text-gray-500 flex-1 line-through leading-relaxed">
              {problem.text}
            </p>
            <button
              onClick={() => handleDelete(problem.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 rounded transition-all shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function meetingWord(count: number): string {
  if (count === 1) return 'встреча';
  if (count >= 2 && count <= 4) return 'встречи';
  return 'встреч';
}
