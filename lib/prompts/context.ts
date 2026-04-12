export function buildContextSummaryPrompt(meetingsSummary: string, count: number): { system: string; user: string } {
  const system = `Сожми информацию о ${count} встречах с руководителем в краткий контекст (не более 500 слов).
Выдели: ключевые тренды, незакрытые вопросы, прогресс по договорённостям.
Язык: русский.`;

  const user = `Встречи (от старой к новой):
${meetingsSummary}

Подготовь краткий контекст.`;

  return { system, user };
}
