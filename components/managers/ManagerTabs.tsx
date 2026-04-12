'use client';

import { useState } from 'react';
import { ManagerProfile } from './ManagerProfile';
import { MeetingHistory } from './MeetingHistory';
import { DocumentLibrary } from '@/components/documents/DocumentLibrary';
import { AgentChat } from './AgentChat';
import { InterimEvents } from './InterimEvents';
import { GoalsTree } from './GoalsTree';
import { ManagerTrackPanel } from './ManagerTrackPanel';
import type { Manager, Meeting, UserRole } from '@/types';

type Tab = 'meetings' | 'track' | 'library' | 'chat' | 'events' | 'goals';

const TABS: { id: Tab; label: string }[] = [
  { id: 'meetings', label: 'Встречи' },
  { id: 'track', label: 'Трек' },
  { id: 'library', label: 'Библиотека' },
  { id: 'chat', label: 'Чат с AI' },
  { id: 'events', label: 'События' },
  { id: 'goals', label: 'Цели' },
];

interface ManagerTabsProps {
  manager: Manager;
  companyId: string;
  meetings: Meeting[];
  currentUserId: string;
  userRole: UserRole;
}

export function ManagerTabs({ manager, companyId, meetings, currentUserId, userRole }: ManagerTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('meetings');

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Profile - left column */}
      <div className="lg:col-span-2">
        <ManagerProfile
          manager={manager}
          companyId={companyId}
          currentUserId={currentUserId}
          userRole={userRole}
        />
      </div>

      {/* Right column with tabs */}
      <div className="lg:col-span-3">
        {/* Tab bar */}
        <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'meetings' && (
            <MeetingHistory
              meetings={meetings}
              managerId={manager.id}
              managerName={manager.name}
              currentUserId={currentUserId}
              userRole={userRole}
            />
          )}
          {activeTab === 'track' && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Трек развития
              </h3>
              <ManagerTrackPanel managerId={manager.id} managerName={manager.name} userRole={userRole} />
            </div>
          )}
          {activeTab === 'library' && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Библиотека документов</h3>
              <DocumentLibrary managerId={manager.id} userRole={userRole} />
            </div>
          )}
          {activeTab === 'chat' && (
            <AgentChat managerId={manager.id} managerName={manager.name} />
          )}
          {activeTab === 'events' && (
            <InterimEvents managerId={manager.id} userRole={userRole} />
          )}
          {activeTab === 'goals' && (
            <GoalsTree managerId={manager.id} userRole={userRole} />
          )}
        </div>
      </div>
    </div>
  );
}
