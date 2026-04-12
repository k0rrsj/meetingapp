'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface ConsultantDoc {
  id: string;
  title: string;
  content: string;
  type: string;
  is_active: boolean;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  methodology: 'Методология',
  rules: 'Правила работы',
  framework: 'Фреймворк',
  other: 'Другое',
};

export function ConsultantLibrary() {
  const [docs, setDocs] = useState<ConsultantDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { title: string; content: string; type: string }>>({});
  const [adding, setAdding] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: '', content: '', type: 'methodology' });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/consultant-documents')
      .then((r) => r.json())
      .then((data) => { setDocs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded(expanded === id ? null : id);
    if (!editing[id]) {
      const doc = docs.find((d) => d.id === id);
      if (doc) setEditing((prev) => ({ ...prev, [id]: { title: doc.title, content: doc.content, type: doc.type } }));
    }
  };

  const handleSave = async (id: string) => {
    const e = editing[id];
    if (!e) return;
    setSaving(id);
    try {
      const res = await fetch(`/api/consultant-documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      });
      const updated = await res.json();
      setDocs((prev) => prev.map((d) => d.id === id ? { ...d, ...updated } : d));
      toast.success('Сохранено');
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(null); }
  };

  const handleToggleActive = async (doc: ConsultantDoc) => {
    try {
      const res = await fetch(`/api/consultant-documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !doc.is_active }),
      });
      const updated = await res.json();
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, ...updated } : d));
      toast.success(updated.is_active ? 'Документ включён в контекст AI' : 'Документ отключён от контекста AI');
    } catch { toast.error('Ошибка'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить документ?')) return;
    try {
      await fetch(`/api/consultant-documents/${id}`, { method: 'DELETE' });
      setDocs((prev) => prev.filter((d) => d.id !== id));
      toast.success('Удалено');
    } catch { toast.error('Ошибка удаления'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    e.target.value = '';

    let text = '';
    if (file.name.endsWith('.docx')) {
      setSaving('new');
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/documents/parse-docx', { method: 'POST', body: form });
        if (!res.ok) { toast.error('Ошибка парсинга DOCX'); return; }
        const data = await res.json();
        text = data.text ?? '';
      } catch {
        toast.error('Ошибка загрузки файла');
        return;
      } finally {
        setSaving(null);
      }
    } else {
      text = await file.text();
    }

    setNewDoc({ title: nameWithoutExt, content: text, type: 'methodology' });
    setAdding(true);
  };

  const handleAdd = async () => {
    if (!newDoc.title.trim()) { toast.error('Введите название'); return; }
    setSaving('new');
    try {
      const res = await fetch('/api/consultant-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc),
      });
      const created = await res.json();
      setDocs((prev) => [created, ...prev]);
      setNewDoc({ title: '', content: '', type: 'methodology' });
      setAdding(false);
      toast.success('Документ добавлен');
    } catch { toast.error('Ошибка'); }
    finally { setSaving(null); }
  };

  if (loading) return <div className="text-sm text-gray-500">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Библиотека консультанта</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Документы включаются в контекст AI для всех руководителей и компаний
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <input
              type="file"
              accept=".txt,.md,.docx"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Upload className="w-4 h-4" />
            Загрузить файл
          </label>
          <button
            onClick={() => { setNewDoc({ title: '', content: '', type: 'methodology' }); setAdding(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      {/* Add new */}
      {adding && (
        <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50 dark:bg-blue-950/30 space-y-3">
          <input
            value={newDoc.title}
            onChange={(e) => setNewDoc((p) => ({ ...p, title: e.target.value }))}
            placeholder="Название документа (напр. Intellect Core 2.0)"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
          />
          <select
            value={newDoc.type}
            onChange={(e) => setNewDoc((p) => ({ ...p, type: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none"
          >
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <textarea
            value={newDoc.content}
            onChange={(e) => setNewDoc((p) => ({ ...p, content: e.target.value }))}
            placeholder="Содержание документа..."
            rows={8}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 font-mono resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving === 'new'}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving === 'new' ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewDoc({ title: '', content: '', type: 'methodology' }); }}
              className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 && !adding && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          Нет документов. Добавьте методологию или правила работы.
        </div>
      )}

      {/* Docs list */}
      <div className="space-y-2">
        {docs.map((doc) => {
          const e = editing[doc.id];
          const isOpen = expanded === doc.id;
          return (
            <div key={doc.id} className={`border rounded-xl overflow-hidden transition-colors ${doc.is_active ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800 opacity-60'}`}>
              <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900">
                <button onClick={() => toggleExpand(doc.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">{doc.title}</span>
                    <span className="text-xs text-gray-400">{TYPE_LABELS[doc.type] ?? doc.type}</span>
                  </div>
                </button>
                <button
                  onClick={() => handleToggleActive(doc)}
                  title={doc.is_active ? 'Отключить от AI' : 'Включить в AI'}
                  className="shrink-0"
                >
                  {doc.is_active
                    ? <ToggleRight className="w-5 h-5 text-blue-500" />
                    : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                </button>
                <button onClick={() => handleDelete(doc.id)} className="shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {isOpen && e && (
                <div className="px-4 pb-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 space-y-3 pt-3">
                  <input
                    value={e.title}
                    onChange={(ev) => setEditing((prev) => ({ ...prev, [doc.id]: { ...prev[doc.id], title: ev.target.value } }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                  />
                  <select
                    value={e.type}
                    onChange={(ev) => setEditing((prev) => ({ ...prev, [doc.id]: { ...prev[doc.id], type: ev.target.value } }))}
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none"
                  >
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <textarea
                    value={e.content}
                    onChange={(ev) => setEditing((prev) => ({ ...prev, [doc.id]: { ...prev[doc.id], content: ev.target.value } }))}
                    rows={12}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 font-mono resize-y"
                  />
                  <button
                    onClick={() => handleSave(doc.id)}
                    disabled={saving === doc.id}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving === doc.id ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
