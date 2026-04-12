'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, X, History, Eye, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Document, DocumentVersion, DocumentType } from '@/types';

const TYPE_LABELS: Record<DocumentType, string> = {
  track: 'Трек развития',
  roadmap: 'Дорожная карта',
  chronology: 'Хронология',
  other: 'Документ',
};

const TYPE_COLORS: Record<DocumentType, string> = {
  track: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300',
  roadmap: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300',
  chronology: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300',
  other: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
};

interface DocumentEditorProps {
  document: Document;
  onUpdate: (updated: Document) => void;
  onClose: () => void;
}

export function DocumentEditor({ document, onUpdate, onClose }: DocumentEditorProps) {
  const [editing, setEditing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка сохранения');
        return;
      }
      const updated = await res.json();
      onUpdate(updated);
      setEditing(false);
      toast.success('Документ сохранён');
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setTitle(document.title);
    setContent(document.content);
    setEditing(false);
  }

  async function loadVersions() {
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/documents/${document.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
        setShowVersions(true);
      }
    } catch {
      toast.error('Ошибка загрузки истории');
    } finally {
      setLoadingVersions(false);
    }
  }

  function restoreVersion(v: DocumentVersion) {
    setContent(v.content);
    setShowVersions(false);
    setEditing(true);
    toast.info('Версия восстановлена — сохраните для применения');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base font-semibold"
            />
          ) : (
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {document.title}
            </h3>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[document.type]}`}>
              {TYPE_LABELS[document.type]}
            </span>
            <span className="text-xs text-gray-400">
              Обновлён {format(new Date(document.updated_at), 'd MMM yyyy', { locale: ru })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Check className="w-3.5 h-3.5 mr-1" />
                {saving ? 'Сохраняю...' : 'Сохранить'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Изменить
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={showVersions ? () => setShowVersions(false) : loadVersions}
                disabled={loadingVersions}
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                История
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Version history panel */}
      {showVersions && (
        <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              История версий
            </span>
          </div>
          {versions.length === 0 ? (
            <p className="text-sm text-gray-400 p-3">Версий нет</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-40 overflow-y-auto">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {format(new Date(v.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
                  </span>
                  <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => restoreVersion(v)}>
                    Восстановить
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0">
        {editing ? (
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Содержимое (Markdown)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-sm resize-none"
              style={{ minHeight: '400px' }}
              autoFocus
            />
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none overflow-auto max-h-[500px] px-1">
            {content
              ? <ReactMarkdown>{content}</ReactMarkdown>
              : <p className="text-gray-400 italic text-sm">Документ пуст</p>
            }
          </div>
        )}
      </div>
    </div>
  );
}
