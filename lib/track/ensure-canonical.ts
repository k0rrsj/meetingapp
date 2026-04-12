import type { SupabaseClient } from '@supabase/supabase-js';
import type { Document } from '@/types';
import { buildStructuredTrackMarkdown } from './template';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface EnsureTrackContext {
  managerId: string;
  managerName: string;
  position: string | null;
  companyName: string;
  consultantName: string;
  actingUserId: string;
}

/**
 * Returns the latest type=track document for the manager, or creates one from the v1 template.
 */
export async function ensureCanonicalTrackDocument(
  supabase: SupabaseClient,
  ctx: EnsureTrackContext
): Promise<{ document: Document; created: boolean }> {
  const { data: existing } = await supabase
    .from('documents')
    .select('*')
    .eq('manager_id', ctx.managerId)
    .eq('type', 'track')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { document: existing as Document, created: false };
  }

  const createdDateRu = format(new Date(), 'd MMMM yyyy', { locale: ru });
  const content = buildStructuredTrackMarkdown({
    managerName: ctx.managerName,
    position: ctx.position ?? '',
    companyName: ctx.companyName,
    consultantName: ctx.consultantName,
    createdDateRu,
  });

  const title = `Трек развития — ${ctx.managerName}`;

  const { data: inserted, error } = await supabase
    .from('documents')
    .insert({
      manager_id: ctx.managerId,
      company_id: null,
      title,
      content,
      type: 'track',
      created_by: ctx.actingUserId,
    })
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? 'Не удалось создать документ трека');
  }

  return { document: inserted as Document, created: true };
}
