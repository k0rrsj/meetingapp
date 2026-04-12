/** Stable section ids for programmatic merge (must match template markers). */
export const TRACK_SECTION_IDS = [
  'header',
  'profile',
  'chronology',
  'patterns',
  'beliefs',
  'progress',
  'people',
  'tools',
  'risks',
  'priorities',
  'metrics',
  'open_questions',
  'footer',
] as const;

export type TrackSectionId = (typeof TRACK_SECTION_IDS)[number];

export const TRACK_SECTION_ID_SET = new Set<string>(TRACK_SECTION_IDS);

export const TRACK_V1_BANNER = '<!-- track:v1 structured -->';

export function isStructuredTrackContent(content: string): boolean {
  return content.includes(TRACK_V1_BANNER) && TRACK_SECTION_IDS.every((id) =>
    content.includes(`<!-- track:section:${id} -->`)
  );
}
