'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ChevronRight, ChevronDown, Check, X, Target } from 'lucide-react';
import { toast } from 'sonner';
import type { Goal, GoalStatus, UserRole } from '@/types';

interface GoalsTreeProps {
  managerId: string;
  userRole: UserRole;
}

const STATUS_CONFIG: Record<GoalStatus, { label: string; color: string; bg: string }> = {
  planned: { label: 'Планируется', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
  in_progress: { label: 'В работе', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  completed: { label: 'Выполнено', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
};

function buildTree(goals: Goal[]): Goal[] {
  const map = new Map<string, Goal>();
  goals.forEach((g) => map.set(g.id, { ...g, children: [] }));

  const roots: Goal[] = [];
  map.forEach((g) => {
    if (g.parent_id && map.has(g.parent_id)) {
      map.get(g.parent_id)!.children!.push(g);
    } else {
      roots.push(g);
    }
  });
  return roots;
}

interface GoalNodeProps {
  goal: Goal;
  depth: number;
  managerId: string;
  onUpdate: (id: string, updates: Partial<Goal>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, title: string) => void;
}

function GoalNode({ goal, depth, managerId, onUpdate, onDelete, onAddChild }: GoalNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(goal.title);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasChildren = (goal.children?.length ?? 0) > 0;
  const status = STATUS_CONFIG[goal.status];

  function cycleStatus() {
    const order: GoalStatus[] = ['planned', 'in_progress', 'completed'];
    const next = order[(order.indexOf(goal.status) + 1) % order.length];
    onUpdate(goal.id, { status: next });
  }

  function handleProgressChange(e: React.ChangeEvent<HTMLInputElement>) {
    onUpdate(goal.id, { progress: Number(e.target.value) });
  }

  function handleSaveTitle() {
    if (editTitle.trim() && editTitle !== goal.title) {
      onUpdate(goal.id, { title: editTitle.trim() });
    }
    setEditing(false);
  }

  function handleAddChild() {
    if (!childTitle.trim()) return;
    onAddChild(goal.id, childTitle.trim());
    setChildTitle('');
    setAddingChild(false);
    setExpanded(true);
  }

  return (
    <div style={{ paddingLeft: depth > 0 ? `${depth * 20}px` : 0 }}>
      <div className={`group flex items-start gap-2 p-2.5 rounded-lg mb-1 border ${status.bg} border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors`}>
        {/* Expand toggle */}
        <button
          className="mt-0.5 shrink-0"
          onClick={() => hasChildren && setExpanded((v) => !v)}
        >
          {hasChildren
            ? expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            : <span className="w-3.5 h-3.5 block" />
          }
        </button>

        {/* Status dot */}
        <button
          onClick={cycleStatus}
          title={`Статус: ${status.label} (нажмите для смены)`}
          className={`w-3 h-3 rounded-full mt-1 shrink-0 transition-transform hover:scale-125 ${
            goal.status === 'completed' ? 'bg-green-500' :
            goal.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />

        {/* Title */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditing(false); }}
                className="h-6 text-sm py-0 px-2"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSaveTitle}>
                <Check className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditing(false)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <p
              className={`text-sm font-medium cursor-pointer ${
                goal.status === 'completed'
                  ? 'line-through text-gray-400 dark:text-gray-500'
                  : 'text-gray-800 dark:text-gray-200'
              }`}
              onDoubleClick={() => setEditing(true)}
              title="Дважды кликните для редактирования"
            >
              {goal.title}
            </p>
          )}

          {/* Progress bar */}
          {goal.status !== 'completed' && goal.status !== 'planned' && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={goal.progress}
                onChange={handleProgressChange}
                className="w-16 h-1.5 accent-blue-500"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{goal.progress}%</span>
            </div>
          )}

          {goal.status === 'completed' && (
            <div className="mt-1">
              <div className="h-1.5 bg-green-200 dark:bg-green-900/40 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full w-full" />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {depth < 2 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
              onClick={() => setAddingChild(true)}
              title="Добавить подцель"
            >
              <Plus className="w-3 h-3" />
            </Button>
          )}
          {confirmDelete ? (
            <>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500 px-1" onClick={() => onDelete(goal.id)}>
                Да
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => setConfirmDelete(false)}>
                Нет
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-gray-300 hover:text-red-500"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Add child form */}
      {addingChild && (
        <div style={{ paddingLeft: `${(depth + 1) * 20}px` }} className="mb-1">
          <div className="flex items-center gap-1 p-1">
            <Input
              value={childTitle}
              onChange={(e) => setChildTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddChild(); if (e.key === 'Escape') setAddingChild(false); }}
              placeholder="Название подцели..."
              className="h-7 text-sm"
              autoFocus
            />
            <Button size="sm" className="h-7 px-2" onClick={handleAddChild} disabled={!childTitle.trim()}>
              <Check className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAddingChild(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Children */}
      {expanded && goal.children?.map((child) => (
        <GoalNode
          key={child.id}
          goal={child}
          depth={depth + 1}
          managerId={managerId}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
}

export function GoalsTree({ managerId, userRole }: GoalsTreeProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, [managerId]);

  async function fetchGoals() {
    setLoading(true);
    try {
      const res = await fetch(`/api/goals?manager_id=${managerId}`);
      if (res.ok) setGoals(await res.json());
    } catch {
      toast.error('Ошибка загрузки целей');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: managerId, title: newTitle.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка создания');
        return;
      }
      const created: Goal = await res.json();
      setGoals((prev) => [...prev, created]);
      setNewTitle('');
      setAdding(false);
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddChild(parentId: string, title: string) {
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: managerId, parent_id: parentId, title }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка создания');
        return;
      }
      const created: Goal = await res.json();
      setGoals((prev) => [...prev, created]);
    } catch {
      toast.error('Ошибка соединения');
    }
  }

  async function handleUpdate(id: string, updates: Partial<Goal>) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        toast.error('Ошибка сохранения');
        fetchGoals();
      }
    } catch {
      toast.error('Ошибка соединения');
      fetchGoals();
    }
  }

  async function handleDelete(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id && g.parent_id !== id));
    try {
      await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    } catch {
      toast.error('Ошибка удаления');
      fetchGoals();
    }
  }

  const tree = buildTree(goals);
  const completedCount = goals.filter((g) => g.status === 'completed').length;
  const totalCount = goals.length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Дерево целей</h3>
          {totalCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {completedCount} из {totalCount} выполнено
            </p>
          )}
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Добавить цель
          </Button>
        )}
      </div>

      {/* Overall progress */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{Math.round((completedCount / totalCount) * 100)}%</span>
        </div>
      )}

      {/* Add root goal form */}
      {adding && (
        <div className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Название цели..."
            className="h-7 text-sm"
            autoFocus
          />
          <Button size="sm" className="h-7 px-2" onClick={handleAdd} disabled={saving || !newTitle.trim()}>
            <Check className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAdding(false)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Tree */}
      {loading ? (
        <div className="text-sm text-gray-400 text-center py-6">Загрузка...</div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Target className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Целей нет</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Добавьте цели и подцели для этого руководителя
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            Нажмите на цветную точку для смены статуса · Двойной клик для редактирования · + для подцели
          </p>
          {tree.map((goal) => (
            <GoalNode
              key={goal.id}
              goal={goal}
              depth={0}
              managerId={managerId}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAddChild={handleAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
