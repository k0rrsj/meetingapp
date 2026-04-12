import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ManagersList } from '@/components/managers/ManagersList';
import { AddManagerDialog } from '@/components/managers/AddManagerDialog';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { CompanyTabs } from '@/components/companies/CompanyTabs';
import type { ManagerWithMetrics, UserRole } from '@/types';

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function ManagersPage({ params }: PageProps) {
  const { companyId } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .single();

  if (!company) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  const userRole: UserRole = profile?.role ?? 'assistant';

  const { data: managers } = await supabase
    .from('managers')
    .select('*')
    .eq('company_id', companyId)
    .order('name');

  const managersWithMetrics: ManagerWithMetrics[] = await Promise.all(
    (managers ?? []).map(async (manager) => {
      const { data: meetings } = await supabase
        .from('meetings')
        .select('date')
        .eq('manager_id', manager.id)
        .order('date', { ascending: false });

      return {
        ...manager,
        meetings_count: meetings?.length ?? 0,
        last_meeting_date: meetings?.[0]?.date ?? null,
      };
    })
  );

  const managersContent = (
    <ManagersList
      managers={managersWithMetrics}
      companyId={companyId}
      userRole={userRole}
    />
  );

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Компании', href: '/companies' },
          { label: company.name },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{company.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {managersWithMetrics.length} руководителей
          </p>
        </div>
        {userRole === 'assistant' && <AddManagerDialog companyId={companyId} />}
      </div>

      <CompanyTabs
        companyId={companyId}
        userRole={userRole}
        managersContent={managersContent}
      />
    </div>
  );
}
