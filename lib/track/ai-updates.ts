import type { SupabaseClient } from '@supabase/supabase-js';
import { TRACK_SECTION_ID_SET } from './section-ids';
import type { TrackSectionUpdate } from './merge-sections';
import { extractJson } from '@/lib/ai/extract-json';

export async function saveDocumentWithVersion(
  supabase: SupabaseClient,
  documentId: string,
  newContent: string,
  userId: string
): Promise<void> {
  const { data: existing } = await supabase.from('documents').select('content').eq('id', documentId).single();
  if (!existing) throw new Error('Документ не найден');

  if (typeof existing.content === 'string' && existing.content !== newContent) {
    const { error: vErr } = await supabase.from('document_versions').insert({
      document_id: documentId,
      content: existing.content,
      created_by: userId,
    });
    if (vErr) throw new Error(vErr.message);
  }

  const { error } = await supabase.from('documents').update({ content: newContent }).eq('id', documentId);
  if (error) throw new Error(error.message);
}

export function parseAiUpdates(raw: string): { updates: TrackSectionUpdate[] } | null {
  const extracted = extractJson(raw);
  if (!extracted.ok || !extracted.value || typeof extracted.value !== 'object') return null;
  const parsed = extracted.value as { updates?: unknown };
  if (!Array.isArray(parsed.updates)) return null;
  const updates: TrackSectionUpdate[] = [];
  for (const item of parsed.updates) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const sectionId = typeof o.sectionId === 'string' ? o.sectionId : '';
    const mode = o.mode === 'replace' ? 'replace' : 'append';
    const markdown = typeof o.markdown === 'string' ? o.markdown : '';
    if (!sectionId || !TRACK_SECTION_ID_SET.has(sectionId)) continue;
    updates.push({ sectionId, mode, markdown });
  }
  return { updates };
}
