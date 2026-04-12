import { TRACK_SECTION_ID_SET, TRACK_SECTION_IDS, type TrackSectionId } from './section-ids';

export type SectionUpdateMode = 'append' | 'replace';

export interface TrackSectionUpdate {
  sectionId: string;
  mode: SectionUpdateMode;
  markdown: string;
}

export interface MergeResult {
  ok: true;
  content: string;
}

export interface MergeError {
  ok: false;
  error: string;
}

/** Returns true if this meeting was already merged into the track document. */
export function trackHasSyncedMeetingMarker(content: string, meetingId: string): boolean {
  return content.includes(`<!-- synced:${meetingId} -->`);
}

export function parseTrackSectionSpans(
  content: string
): Map<TrackSectionId, { bodyStart: number; end: number }> | null {
  const markerRegex = /<!--\s*track:section:([a-z_]+)\s*-->/g;
  const matches: Array<{ id: string; index: number; fullLen: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = markerRegex.exec(content)) !== null) {
    matches.push({ id: m[1], index: m.index, fullLen: m[0].length });
  }
  if (matches.length === 0) return null;

  const map = new Map<TrackSectionId, { bodyStart: number; end: number }>();
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    if (!TRACK_SECTION_ID_SET.has(cur.id)) continue;
    const id = cur.id as TrackSectionId;
    const bodyStart = cur.index + cur.fullLen;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    map.set(id, { bodyStart, end });
  }
  return map;
}

function getBody(content: string, span: { bodyStart: number; end: number }): string {
  return content.slice(span.bodyStart, span.end);
}

function replaceBodyRange(
  content: string,
  bodyStart: number,
  end: number,
  newBody: string
): string {
  return content.slice(0, bodyStart) + newBody + content.slice(end);
}

/**
 * Applies validated section updates without touching markers or headings outside section bodies.
 */
export function mergeTrackSectionUpdates(
  documentContent: string,
  updates: TrackSectionUpdate[],
  options?: { meetingId?: string; appendSyncMarkerToSection?: TrackSectionId }
): MergeResult | MergeError {
  let content = documentContent;

  for (const u of updates) {
    if (!TRACK_SECTION_ID_SET.has(u.sectionId)) {
      return { ok: false, error: `Недопустимый sectionId: ${u.sectionId}` };
    }
    const spans = parseTrackSectionSpans(content);
    if (!spans) {
      return { ok: false, error: 'Документ трека не содержит маркеров секций track:section' };
    }
    const span = spans.get(u.sectionId as TrackSectionId);
    if (!span) {
      return { ok: false, error: `Секция не найдена в документе: ${u.sectionId}` };
    }
    const mode: SectionUpdateMode = u.mode === 'replace' ? 'replace' : 'append';
    const patch = (u.markdown ?? '').trim();
    if (!patch) continue;

    const prevBody = getBody(content, span);
    const nextBody =
      mode === 'replace'
        ? `${patch}\n`
        : `${prevBody.trimEnd()}\n\n${patch}\n`;

    content = replaceBodyRange(content, span.bodyStart, span.end, nextBody);
  }

  if (options?.meetingId && options.appendSyncMarkerToSection) {
    const sid = options.appendSyncMarkerToSection;
    if (!content.includes(`<!-- synced:${options.meetingId} -->`)) {
      const spans = parseTrackSectionSpans(content);
      const span = spans?.get(sid);
      if (span) {
        const marker = `\n\n<!-- synced:${options.meetingId} -->\n`;
        const body = getBody(content, span);
        const newBody = body.trimEnd() + marker;
        content = replaceBodyRange(content, span.bodyStart, span.end, newBody);
      }
    }
  }

  return { ok: true, content };
}

/** Sanity check after merge: all section markers still present. */
export function validateTrackMarkersIntact(content: string): boolean {
  if (!content.includes('<!-- track:v1 structured -->')) return false;
  return TRACK_SECTION_IDS.every((id) => content.includes(`<!-- track:section:${id} -->`));
}
