'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkType } from '@/types';

interface AddManagerDialogProps {
  companyId: string;
}

interface ManagerForm {
  name: string;
  position: string;
  role_in_team: string;
  context: string;
  director_request: string;
  strengths: string;
  weaknesses: string;
  work_type: WorkType;
}

const defaultForm: ManagerForm = {
  name: '', position: '', role_in_team: '', context: '',
  director_request: '', strengths: '', weaknesses: '', work_type: 'one_to_one',
};

export function AddManagerDialog({ companyId }: AddManagerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ManagerForm>(defaultForm);

  function update(field: keyof ManagerForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/companies/${companyId}/managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка создания руководителя');
        return;
      }

      toast.success('Руководитель добавлен');
      setOpen(false);
      setForm(defaultForm);
      router.refresh();
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="w-4 h-4 mr-1.5" />
        Добавить руководителя
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg shadow-xl my-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Новый руководитель</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="mgr-name">Имя *</Label>
              <Input id="mgr-name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Иван Петров" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mgr-position">Должность</Label>
              <Input id="mgr-position" value={form.position} onChange={(e) => update('position', e.target.value)} placeholder="Директор по маркетингу" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mgr-role">Роль в команде</Label>
              <Input id="mgr-role" value={form.role_in_team} onChange={(e) => update('role_in_team', e.target.value)} placeholder="Ключевой игрок" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="mgr-work-type">Тип работы</Label>
              <Select value={form.work_type} onValueChange={(v) => update('work_type', v as WorkType)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {form.work_type === 'one_to_one' ? 'One-to-one / Менторинг' : 'Диагностика'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_to_one">One-to-one / Менторинг</SelectItem>
                  <SelectItem value="diagnostics">Диагностика</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="mgr-context">Контекст</Label>
              <Textarea id="mgr-context" value={form.context} onChange={(e) => update('context', e.target.value)} placeholder="Кто такой, особенности..." rows={3} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="mgr-director">Запрос от директора</Label>
              <Textarea id="mgr-director" value={form.director_request} onChange={(e) => update('director_request', e.target.value)} placeholder="Что сказали про этого человека..." rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mgr-strengths">Сильные стороны</Label>
              <Textarea id="mgr-strengths" value={form.strengths} onChange={(e) => update('strengths', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mgr-weaknesses">Слабые стороны</Label>
              <Textarea id="mgr-weaknesses" value={form.weaknesses} onChange={(e) => update('weaknesses', e.target.value)} rows={2} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Создаю...' : 'Создать'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
