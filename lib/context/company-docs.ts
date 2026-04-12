import type { SupabaseClient } from '@supabase/supabase-js';

export interface CompanyDoc {
  title: string;
  type: string;
  content: string;
}

export async function fetchCompanyDocs(
  supabase: SupabaseClient,
  companyId: string
): Promise<CompanyDoc[]> {
  const { data } = await supabase
    .from('documents')
    .select('title, type, content')
    .eq('company_id', companyId)
    .order('type', { ascending: true })
    .order('updated_at', { ascending: false });

  return (data ?? []).filter((d) => d.content?.trim());
}
