'use client';

import { useState } from 'react';
import { DocumentLibrary } from '@/components/documents/DocumentLibrary';
import type { UserRole } from '@/types';

type Tab = 'managers' | 'library';

interface CompanyTabsProps {
  companyId: string;
  userRole: UserRole;
  managersContent: React.ReactNode;
}

export function CompanyTabs({ companyId, userRole, managersContent }: CompanyTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('managers');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('managers')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'managers'
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Руководители
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'library'
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Библиотека
        </button>
      </div>

      {activeTab === 'managers' && managersContent}
      {activeTab === 'library' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Библиотека документов компании
          </h3>
          <DocumentLibrary companyId={companyId} userRole={userRole} />
        </div>
      )}
    </div>
  );
}
