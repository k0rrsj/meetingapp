import type { PreviousContextJson } from '@/types';

interface MeetingForContext {
  id: string;
  meeting_number: number;
  date: string | null;
  conclusions: string | null;
  action_plan: string | null;
  problems_signals: string | null;
  status: string;
}

interface CommentForContext {
  text: string;
  user_profile?: { role: string };
}

export function buildPreviousContextText(
  meeting: MeetingForContext,
  consultantComments: string[],
  profileComments: string[]
): string {
  const lines: string[] = [];

  lines.push(
    `Встреча №${meeting.meeting_number} от ${meeting.date ?? 'дата не указана'}`
  );

  if (meeting.conclusions) {
    lines.push('');
    lines.push('ВЫВОДЫ:');
    lines.push(meeting.conclusions);
  }

  if (meeting.action_plan) {
    lines.push('');
    lines.push('ПЛАН ДЕЙСТВИЙ:');
    lines.push(meeting.action_plan);
  }

  if (meeting.problems_signals) {
    lines.push('');
    lines.push('ПРОБЛЕМЫ И СИГНАЛЫ:');
    lines.push(meeting.problems_signals);
  }

  if (consultantComments.length > 0) {
    lines.push('');
    lines.push('КОММЕНТАРИИ КОНСУЛЬТАНТА:');
    consultantComments.forEach((c) => lines.push(`- ${c}`));
  }

  if (profileComments.length > 0) {
    lines.push('');
    lines.push('АКТУАЛЬНЫЕ КОММЕНТАРИИ К ПРОФИЛЮ:');
    profileComments.forEach((c) => lines.push(`- ${c}`));
  }

  return lines.join('\n');
}

export function buildPreviousContextJson(
  meeting: MeetingForContext,
  consultantComments: string[],
  profileComments: string[]
): PreviousContextJson {
  return {
    meetingId: meeting.id,
    meetingNumber: meeting.meeting_number,
    date: meeting.date,
    conclusions: meeting.conclusions,
    actionPlan: meeting.action_plan,
    problemsSignals: meeting.problems_signals,
    consultantComments,
    managerProfileComments: profileComments,
  };
}

export function extractConsultantComments(comments: CommentForContext[]): string[] {
  return comments
    .filter((c) => c.user_profile?.role === 'consultant')
    .map((c) => c.text);
}
