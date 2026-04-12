'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DocumentEditor } from './DocumentEditor';
import { Plus, FileText, Trash2, X, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Document, DocumentType } from '@/types';

const TYPE_LABELS: Record<DocumentType, string> = {
  track: 'Трек развития',
  roadmap: 'Дорожная карта',
  chronology: 'Хронология',
  other: 'Документ',
};

const TYPE_COLORS: Record<DocumentType, string> = {
  track: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  roadmap: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
  chronology: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  other: 'text-gray-500 bg-gray-50 dark:bg-gray-800',
};

interface DocumentLibraryProps {
  companyId?: string;
  managerId?: string;
  userRole: 'consultant' | 'assistant';
}

export function DocumentLibrary({ companyId, managerId, userRole }: DocumentLibraryProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Document | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<DocumentType>('other');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [uploadedContent, setUploadedContent] = useState<string>('');

  const ownerParam = companyId ? `company_id=${companyId}` : `manager_id=${managerId}`;

  const canDeleteDocuments =
    userRole === 'assistant' || (userRole === 'consultant' && Boolean(companyId));

  useEffect(() => {
    fetchDocuments();
  }, [companyId, managerId]);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?${ownerParam}`);
      if (res.ok) setDocuments(await res.json());
    } catch {
      toast.error('Ошибка загрузки документов');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    setNewTitle(nameWithoutExt);
    setAdding(true);
    e.target.value = '';

    if (file.name.endsWith('.docx')) {
      setSaving(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/documents/parse-docx', { method: 'POST', body: form });
        if (!res.ok) { toast.error('Ошибка парсинга DOCX'); return; }
        const { text } = await res.json();
        setUploadedContent(text ?? '');
      } catch {
        toast.error('Ошибка загрузки файла');
      } finally {
        setSaving(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedContent((ev.target?.result as string) ?? '');
      };
      reader.readAsText(file, 'UTF-8');
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId ?? null,
          manager_id: managerId ?? null,
          title: newTitle.trim(),
          type: newType,
          content: uploadedContent,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка создания');
        return;
      }
      const created: Document = await res.json();
      setDocuments((prev) => [...prev, created]);
      setNewTitle('');
      setNewType('other');
      setUploadedContent('');
      setAdding(false);
      setSelected(created);
      toast.success('Документ создан');
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка удаления');
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (selected?.id === id) setSelected(null);
      setConfirmDelete(null);
      toast.success('Документ удалён');
    } catch {
      toast.error('Ошибка соединения');
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Загрузка...</div>;
  }

  if (selected) {
    return (
      <DocumentEditor
        document={selected}
        onUpdate={(updated) => {
          setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          setSelected(updated);
        }}
        onClose={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* List */}
      {documents.length === 0 && !adding ? (
        <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-8 italic">
          Документов нет
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
              onClick={() => setSelected(doc)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-md ${TYPE_COLORS[doc.type]}`}>
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-400">
                    {TYPE_LABELS[doc.type]} · {format(new Date(doc.updated_at), 'd MMM yyyy', { locale: ru })}
                  </p>
                </div>
              </div>
              {canDeleteDocuments && (
                <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                  {confirmDelete === doc.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => handleDelete(doc.id)}
                      >
                        Удалить
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => setConfirmDelete(null)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => setConfirmDelete(doc.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Название</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Название документа"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            />
          </div>
          {uploadedContent && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Файл загружен · {uploadedContent.length.toLocaleString('ru')} символов
            </p>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Тип</Label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as DocumentType)}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              {(Object.keys(TYPE_LABELS) as DocumentType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving || !newTitle.trim()}>
              <Check className="w-3.5 h-3.5 mr-1" />
              {saving ? 'Создаю...' : 'Создать'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewTitle(''); setUploadedContent(''); }}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => { setUploadedContent(''); setAdding(true); }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Добавить документ
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".txt,.md,.csv,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
              <Upload className="w-3.5 h-3.5" />
              Загрузить файл
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
