import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ManagerTabs } from '@/components/managers/ManagerTabs';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import type { UserProfile } from '@/types';

interface PageProps {
  params: Promise<{ companyId: string; managerId: string }>;
}

export default async function ManagerPage({ params }: PageProps) {
  const { companyId, managerId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [companyResult, managerResult, profileResult, meetingsResult] = await Promise.all([
    supabase.from('companies').select('id, name').eq('id', companyId).single(),
    supabase.from('managers').select('*').eq('id', managerId).single(),
    supabase.from('user_profiles').select('id, name, role, created_at').eq('id', user.id).single(),
    supabase.from('meetings').select('*').eq('manager_id', managerId).order('meeting_number', { ascending: false }),
  ]);

  if (!companyResult.data || !managerResult.data) notFound();

  const company = companyResult.data;
  const manager = managerResult.data;
  const meetings = meetingsResult.data ?? [];

  const userProfile: UserProfile = profileResult.data ?? {
    id: user.id,
    name: user.email ?? 'Пользователь',
    role: user.user_metadata?.role ?? 'assistant',
    created_at: new Date().toISOString(),
  };

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Компании', href: '/companies' },
          { label: company.name, href: `/companies/${companyId}/managers` },
          { label: manager.name },
        ]}
      />

      <ManagerTabs
        manager={manager}
        companyId={companyId}
        meetings={meetings}
        currentUserId={user.id}
        userRole={userProfile.role}
      />
    </div>
  );
}
