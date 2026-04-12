'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MeetingCard } from '@/components/meetings/MeetingCard';
import { Plus, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { Meeting, UserRole } from '@/types';

interface MeetingHistoryProps {
  meetings: Meeting[];
  managerId: string;
  managerName?: string;
  currentUserId: string;
  userRole: UserRole;
}

export function MeetingHistory({ meetings, managerId, managerName = '', currentUserId, userRole }: MeetingHistoryProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [localMeetings, setLocalMeetings] = useState(meetings);

  const isAssistant = userRole === 'assistant';

  async function handleCreateMeeting() {
    setCreating(true);
    try {
      const res = await fetch(`/api/managers/${managerId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка создания встречи');
        return;
      }

      setLocalMeetings((prev) => [data, ...prev]);
      toast.success(`Встреча №${data.meeting_number} создана`);
      router.refresh();
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">История встреч</h3>
        {isAssistant && (
          <Button size="sm" onClick={handleCreateMeeting} disabled={creating}>
            {creating ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-1.5" />
            )}
            {creating ? 'Создаю...' : 'Новая встреча'}
          </Button>
        )}
      </div>

      {localMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-3" />
          <h4 className="text-gray-600 dark:text-gray-400 font-medium mb-1">Встреч ещё нет</h4>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {isAssistant ? 'Создайте первую встречу' : 'Встречи появятся после создания'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {localMeetings.map((meeting, index) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              currentUserId={currentUserId}
              userRole={userRole}
              defaultOpen={index === 0}
              managerName={managerName}
              onDeleted={(id) => setLocalMeetings((prev) => prev.filter((m) => m.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
