import { createClient } from '@/lib/supabase/server';
import { CompanyCard } from '@/components/companies/CompanyCard';
import { AddCompanyDialog } from '@/components/companies/AddCompanyDialog';
import { Building2 } from 'lucide-react';
import type { CompanyWithMetrics } from '@/types';

async function getCompaniesWithMetrics(supabase: Awaited<ReturnType<typeof createClient>>): Promise<CompanyWithMetrics[]> {
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('name');

  if (!companies?.length) return [];

  const result = await Promise.all(
    companies.map(async (company) => {
      const { data: managers } = await supabase
        .from('managers')
        .select('id, status')
        .eq('company_id', company.id);

      const managerIds = (managers ?? []).map((m) => m.id);
      const activeManagersCount = (managers ?? []).filter((m) => m.status === 'in_progress').length;

      let lastMeetingDate: string | null = null;
      let totalMeetingsCount = 0;
      let closedMeetingsCount = 0;

      if (managerIds.length > 0) {
        const { data: meetings } = await supabase
          .from('meetings')
          .select('date, status')
          .in('manager_id', managerIds);

        totalMeetingsCount = meetings?.length ?? 0;
        closedMeetingsCount = meetings?.filter((m) => m.status === 'closed').length ?? 0;
        const dates = (meetings ?? []).map((m) => m.date).filter(Boolean).sort().reverse();
        lastMeetingDate = dates[0] ?? null;
      }

      return {
        ...company,
        active_managers_count: activeManagersCount,
        last_meeting_date: lastMeetingDate,
        total_meetings_count: totalMeetingsCount,
        closed_meetings_count: closedMeetingsCount,
      } as CompanyWithMetrics;
    })
  );

  return result;
}

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  const isAssistant = profile?.role === 'assistant';
  const companies = await getCompaniesWithMetrics(supabase);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Компании</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{companies.length} компаний</p>
        </div>
        {isAssistant && <AddCompanyDialog />}
      </div>

      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4" />
          <h3 className="text-gray-600 dark:text-gray-400 font-medium mb-1">Нет компаний</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {isAssistant ? 'Добавьте первую компанию, чтобы начать работу' : 'Компании появятся здесь после добавления'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}
