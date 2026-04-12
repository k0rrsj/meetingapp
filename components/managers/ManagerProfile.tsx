'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CommentsList } from '@/components/comments/CommentsList';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Manager, UserRole } from '@/types';

interface ManagerProfileProps {
  manager: Manager;
  companyId: string;
  currentUserId: string;
  userRole: UserRole;
}

const WORK_TYPE_LABELS = {
  one_to_one: 'One-to-one',
  diagnostics: 'Диагностика',
};

export function ManagerProfile({ manager: initialManager, companyId, currentUserId, userRole }: ManagerProfileProps) {
  const router = useRouter();
  const [manager, setManager] = useState(initialManager);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingComments, setEditingComments] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: manager.name,
    position: manager.position ?? '',
    role_in_team: manager.role_in_team ?? '',
    context: manager.context ?? '',
    director_request: manager.director_request ?? '',
    strengths: manager.strengths ?? '',
    weaknesses: manager.weaknesses ?? '',
  });
  const [commentsText, setCommentsText] = useState(manager.consultant_comments ?? '');
  const [saving, setSaving] = useState(false);

  const isAssistant = userRole === 'assistant';
  const isConsultant = userRole === 'consultant';

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch(`/api/managers/${manager.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });

      if (res.ok) {
        const updated = await res.json();
        setManager(updated);
        setEditingProfile(false);
        toast.success('Профиль обновлён');
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка сохранения');
      }
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/managers/${manager.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Руководитель удалён');
        router.push(`/companies/${companyId}/managers`);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка удаления');
        setConfirmDelete(false);
      }
    } catch {
      toast.error('Ошибка соединения');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function saveConsultantComments() {
    setSaving(true);
    try {
      const res = await fetch(`/api/managers/${manager.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultant_comments: commentsText }),
      });

      if (res.ok) {
        const updated = await res.json();
        setManager(updated);
        setEditingComments(false);
        toast.success('Комментарии сохранены');
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка сохранения');
      }
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      {/* Profile header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          {editingProfile ? (
            <Input
              value={profileForm.name}
              onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
              className="text-xl font-bold mb-2"
            />
          ) : (
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{manager.name}</h2>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {editingProfile ? (
              <Input
                value={profileForm.position}
                onChange={(e) => setProfileForm((p) => ({ ...p, position: e.target.value }))}
                placeholder="Должность"
                className="text-sm w-48"
              />
            ) : (
              manager.position && <span className="text-gray-500 dark:text-gray-400 text-sm">{manager.position}</span>
            )}
            {manager.role_in_team && !editingProfile && (
              <span className="text-gray-400">·</span>
            )}
            {editingProfile ? (
              <Input
                value={profileForm.role_in_team}
                onChange={(e) => setProfileForm((p) => ({ ...p, role_in_team: e.target.value }))}
                placeholder="Роль в команде"
                className="text-sm w-40"
              />
            ) : (
              manager.role_in_team && <span className="text-gray-500 dark:text-gray-400 text-sm">{manager.role_in_team}</span>
            )}
            <Badge variant="outline" className="text-xs">
              {WORK_TYPE_LABELS[manager.work_type]}
            </Badge>
            <Badge variant={manager.status === 'in_progress' ? 'default' : 'secondary'} className="text-xs">
              {manager.status === 'in_progress' ? 'В процессе' : 'Завершён'}
            </Badge>
          </div>
        </div>
        {isAssistant && (
          editingProfile ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveProfile} disabled={saving}>
                <Check className="w-3.5 h-3.5 mr-1" />
                {saving ? 'Сохраняю...' : 'Сохранить'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingProfile(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Удалить?</span>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Удаляю...' : 'Да, удалить'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditingProfile(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Изменить
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )
        )}
      </div>

      <Separator className="mb-4" />

      {/* Profile fields */}
      <div className="space-y-4">
        <ProfileField
          label="Контекст"
          value={editingProfile ? profileForm.context : (manager.context ?? '')}
          editing={editingProfile}
          onChange={(v) => setProfileForm((p) => ({ ...p, context: v }))}
        />
        <ProfileField
          label="Запрос от директора"
          value={editingProfile ? profileForm.director_request : (manager.director_request ?? '')}
          editing={editingProfile}
          onChange={(v) => setProfileForm((p) => ({ ...p, director_request: v }))}
        />

        <div className="grid md:grid-cols-2 gap-4">
          <ProfileField
            label="Сильные стороны"
            value={editingProfile ? profileForm.strengths : (manager.strengths ?? '')}
            editing={editingProfile}
            onChange={(v) => setProfileForm((p) => ({ ...p, strengths: v }))}
          />
          <ProfileField
            label="Слабые стороны"
            value={editingProfile ? profileForm.weaknesses : (manager.weaknesses ?? '')}
            editing={editingProfile}
            onChange={(v) => setProfileForm((p) => ({ ...p, weaknesses: v }))}
          />
        </div>

        <Separator />

        {/* Consultant comments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-gray-700">Заметки консультанта</Label>
            {isConsultant && (
              editingComments ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveConsultantComments} disabled={saving}>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {saving ? 'Сохраняю...' : 'Сохранить'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingComments(false); setCommentsText(manager.consultant_comments ?? ''); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setEditingComments(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Изменить
                </Button>
              )
            )}
          </div>
          {editingComments ? (
            <Textarea
              value={commentsText}
              onChange={(e) => setCommentsText(e.target.value)}
              rows={3}
              className="text-sm"
              autoFocus
            />
          ) : (
              manager.consultant_comments ? (
              <p className="text-sm text-gray-700 dark:text-gray-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-100 dark:border-amber-900/50">
                {manager.consultant_comments}
              </p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">—</p>
            )
          )}
        </div>

        <Separator />

        {/* Comments section */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Комментарии к профилю</h4>
          <CommentsList
            targetType="manager"
            targetId={manager.id}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  );
}

interface ProfileFieldProps {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
}

function ProfileField({ label, value, editing, onChange }: ProfileFieldProps) {
  if (!editing && !value) return null;

  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</Label>
      {editing ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="text-sm" />
      ) : (
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{value}</p>
      )}
    </div>
  );
}
