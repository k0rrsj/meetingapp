'use client';

import { useState, useEffect } from 'react';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Comment, CommentTarget } from '@/types';

interface CommentsListProps {
  targetType: CommentTarget;
  targetId: string;
  currentUserId: string;
}

export function CommentsList({ targetType, targetId, currentUserId }: CommentsListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  async function loadComments() {
    const res = await fetch(
      `/api/comments?target_type=${targetType}&target_id=${targetId}`
    );
    if (res.ok) {
      const data = await res.json();
      setComments(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadComments();
  }, [targetType, targetId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, text: newText }),
      });

      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setNewText('');
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка добавления комментария');
      }
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(id: string) {
    if (!editText.trim()) return;

    const res = await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editText }),
    });

    if (res.ok) {
      const updated = await res.json();
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
    } else {
      toast.error('Ошибка редактирования');
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    } else {
      toast.error('Ошибка удаления');
    }
  }

  return (
    <div className="space-y-3">
      {!loading && comments.length === 0 && (
        <p className="text-sm text-gray-400 italic">Комментариев пока нет</p>
      )}

      {comments.map((comment) => (
        <div key={comment.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {comment.user_profile?.name ?? 'Пользователь'}
              <span className="ml-1 font-normal text-gray-400">
                · {formatDateTime(comment.created_at)}
              </span>
            </span>
            {comment.user_id === currentUserId && (
              <div className="flex gap-1">
                {editingId === comment.id ? (
                  <>
                    <button onClick={() => handleEdit(comment.id)} className="text-green-600 hover:text-green-700">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingId(comment.id); setEditText(comment.text); }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(comment.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {editingId === comment.id ? (
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="text-sm mt-1"
              autoFocus
            />
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.text}</p>
          )}
        </div>
      ))}

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Добавить комментарий..."
          rows={2}
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={submitting || !newText.trim()}>
          {submitting ? 'Отправляю...' : 'Добавить'}
        </Button>
      </form>
    </div>
  );
}
