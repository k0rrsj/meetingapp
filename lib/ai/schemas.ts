/**
 * Schemas / normalizers for every place the app expects structured AI output.
 *
 * Each validator returns a fully-normalized object: arrays are always present
 * (never undefined), strings are trimmed, unknown items are dropped. This is the
 * contract that protects the UI from malformed-but-parseable AI responses.
 */

import type { ProblemDeltaItem } from '@/types';
import {
  asArray,
  asNumber,
  asString,
  asStringArray,
  asTrimmedString,
  isRecord,
  type ValidationResult,
} from './validate';

// ---------------------------------------------------------------------------
// analyze-transcription
// ---------------------------------------------------------------------------

const ANALYSIS_STRING_FIELDS = [
  'key_facts',
  'problems_signals',
  'conclusions',
  'strengths',
  'weaknesses',
  'action_plan',
  'next_scenario',
] as const;

export interface MeetingAnalysis {
  fields: Partial<Record<(typeof ANALYSIS_STRING_FIELDS)[number], string>>;
  diagnostic_extension?: Record<string, unknown>;
  problems_delta: ProblemDeltaItem[];
}

export function validateMeetingAnalysis(value: unknown): ValidationResult<MeetingAnalysis> {
  if (!isRecord(value)) {
    return { ok: false, error: 'analysis is not an object' };
  }

  const fields: MeetingAnalysis['fields'] = {};
  for (const field of ANALYSIS_STRING_FIELDS) {
    const str = asString(value[field]);
    if (str && str.trim()) fields[field] = str.trim();
  }

  // At least one usable field must be present, otherwise the response is useless.
  const hasContent = Object.keys(fields).length > 0;
  const hasExtension =
    isRecord(value.diagnostic_extension) && Object.keys(value.diagnostic_extension).length > 0;
  if (!hasContent && !hasExtension) {
    return { ok: false, error: 'analysis has no usable fields' };
  }

  const result: MeetingAnalysis = { fields, problems_delta: [] };

  if (isRecord(value.diagnostic_extension)) {
    result.diagnostic_extension = value.diagnostic_extension;
  }

  for (const item of asArray(value.problems_delta)) {
    if (!isRecord(item)) continue;
    const action = item.action;
    if (action === 'new' && asTrimmedString(item.text)) {
      result.problems_delta.push({ action: 'new', text: asTrimmedString(item.text) });
    } else if ((action === 'ongoing' || action === 'resolved') && asString(item.problem_id)) {
      result.problems_delta.push({
        action,
        problem_id: asString(item.problem_id),
        resolution_note: asString(item.resolution_note),
      });
    }
  }

  return { ok: true, data: result };
}

// ---------------------------------------------------------------------------
// people extraction (analyze-transcription, second pass)
// ---------------------------------------------------------------------------

export interface PersonCandidate {
  name: string;
  position?: string;
  context?: string;
}

export function validatePeopleCandidates(value: unknown): ValidationResult<PersonCandidate[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'people candidates is not an array' };
  }
  const people: PersonCandidate[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name = asTrimmedString(item.name);
    if (!name) continue;
    people.push({
      name,
      position: asString(item.position)?.trim() || undefined,
      context: asString(item.context)?.trim() || undefined,
    });
  }
  return { ok: true, data: people };
}

// ---------------------------------------------------------------------------
// update-track (manual "обновить трек по расшифровке" → TrackUpdateDiff UI)
// ---------------------------------------------------------------------------

export interface TrackAddition {
  section: string;
  content: string;
  type: string;
}
export interface TrackActionItem {
  what: string;
  deadline: string;
  report_format: string;
}
export interface TrackMentionedPerson {
  name: string;
  is_new: boolean;
  delta: string;
}
export interface TrackUpdateAnalysis {
  summary: string;
  additions: TrackAddition[];
  new_action_items: TrackActionItem[];
  mentioned_people: TrackMentionedPerson[];
}

export function validateTrackUpdateAnalysis(value: unknown): ValidationResult<TrackUpdateAnalysis> {
  if (!isRecord(value)) {
    return { ok: false, error: 'track analysis is not an object' };
  }

  const additions: TrackAddition[] = asArray(value.additions)
    .filter(isRecord)
    .map((item) => ({
      section: asTrimmedString(item.section),
      content: asTrimmedString(item.content),
      type: asTrimmedString(item.type) || 'note',
    }))
    .filter((a) => a.section || a.content);

  const newActionItems: TrackActionItem[] = asArray(value.new_action_items)
    .filter(isRecord)
    .map((item) => ({
      what: asTrimmedString(item.what),
      deadline: asTrimmedString(item.deadline),
      report_format: asTrimmedString(item.report_format),
    }))
    .filter((a) => a.what);

  const mentionedPeople: TrackMentionedPerson[] = asArray(value.mentioned_people)
    .filter(isRecord)
    .map((item) => ({
      name: asTrimmedString(item.name),
      is_new: item.is_new === true,
      delta: asTrimmedString(item.delta),
    }))
    .filter((p) => p.name);

  const summary = asTrimmedString(value.summary);

  if (!summary && additions.length === 0 && newActionItems.length === 0 && mentionedPeople.length === 0) {
    return { ok: false, error: 'track analysis is empty' };
  }

  return {
    ok: true,
    data: {
      summary,
      additions,
      new_action_items: newActionItems,
      mentioned_people: mentionedPeople,
    },
  };
}

// ---------------------------------------------------------------------------
// dynamics snapshot
// ---------------------------------------------------------------------------

export interface DynamicsSnapshotNormalized {
  installations: Array<Record<string, unknown>>;
  patterns: Array<Record<string, unknown>>;
  commitments: Array<Record<string, unknown>>;
  summary: Record<string, number>;
}

export function validateDynamicsSnapshot(value: unknown): ValidationResult<DynamicsSnapshotNormalized> {
  if (!isRecord(value)) {
    return { ok: false, error: 'dynamics snapshot is not an object' };
  }

  const installations = asArray(value.installations).filter(isRecord);
  const patterns = asArray(value.patterns).filter(isRecord);
  const commitments = asArray(value.commitments).filter(isRecord);

  const summary: Record<string, number> = {};
  if (isRecord(value.summary)) {
    for (const [key, raw] of Object.entries(value.summary)) {
      const n = asNumber(raw);
      if (n !== undefined) summary[key] = n;
    }
  }

  return {
    ok: true,
    data: { installations, patterns, commitments, summary },
  };
}

export { asStringArray };
