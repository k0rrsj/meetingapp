'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, User, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { ChatMessage } from '@/types';

interface AgentChatProps {
  managerId: string;
  managerName: string;
}

export function AgentChat({ managerId, managerName }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, [managerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchHistory() {
    setInitialLoading(true);
    try {
      const res = await fetch(`/api/ai/chat?manager_id=${managerId}`);
      if (res.ok) setMessages(await res.json());
    } catch {
      // ignore
    } finally {
      setInitialLoading(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      manager_id: managerId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: managerId, message: text }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Ошибка запроса');
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(text);
        return;
      }

      const { reply } = await res.json();
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        manager_id: managerId,
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      toast.error('Ошибка соединения');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col h-[600px]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI-агент</p>
            <p className="text-xs text-gray-400">Контекст: {managerName}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <Bot className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Начните диалог. Агент работает в контексте {managerName}.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'assistant'
                  ? 'bg-blue-100 dark:bg-blue-950/50'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                {msg.role === 'assistant'
                  ? <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  : <User className="w-4 h-4 text-gray-500" />
                }
              </div>
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-tr-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                <span className="text-xs text-gray-400 px-1">
                  {format(new Date(msg.created_at), 'HH:mm', { locale: ru })}
                </span>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5">
              <Loader className="w-4 h-4 text-gray-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите сообщение... (Ctrl+Enter для отправки)"
            rows={2}
            className="resize-none text-sm flex-1"
            disabled={loading}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="shrink-0 h-10"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
