interface ManagerContext {
  name: string;
  position: string | null;
  role_in_team: string | null;
  context: string | null;
  director_request: string | null;
  strengths: string | null;
  weaknesses: string | null;
  consultant_comments: string | null;
  ai_rules: string | null;
}

interface AgentContext {
  manager: ManagerContext;
  trackContent?: string | null;
  chronologyContent?: string | null;
  consultantDocs?: Array<{ title: string; content: string }> | null;
  companyDocs?: Array<{ title: string; type: string; content: string }> | null;
}

export function buildAgentSystemPrompt(ctx: AgentContext): string {
  const { manager, trackContent, chronologyContent, consultantDocs, companyDocs } = ctx;

  const sections: string[] = [];

  // Layer 0: Consultant methodology (global docs)
  if (consultantDocs && consultantDocs.length > 0) {
    const docsText = consultantDocs
      .map((d) => `--- ${d.title} ---\n${d.content}`)
      .join('\n\n');
    sections.push(`=== МЕТОДОЛОГИЯ И ПОДХОД КОНСУЛЬТАНТА ===\n${docsText}`);
  }

  // Layer 1: Base role
  sections.push(`Ты — персональный AI-ассистент управленческого консультанта.
Ты работаешь строго в контексте одного конкретного руководителя — ${manager.name}.
Твоя задача: помогать консультанту готовиться к сессиям, анализировать ситуации и вырабатывать точные рекомендации.
Ты используешь только информацию из этого контекста. Данные других руководителей тебе недоступны.
Язык: русский. Стиль: деловой, конкретный, без воды и общих слов.`);

  // Layer 2: Manager profile
  const profileLines: string[] = [`\n=== ПРОФИЛЬ РУКОВОДИТЕЛЯ ===`];
  profileLines.push(`Имя: ${manager.name}`);
  if (manager.position) profileLines.push(`Должность: ${manager.position}`);
  if (manager.role_in_team) profileLines.push(`Роль в команде: ${manager.role_in_team}`);
  if (manager.context) profileLines.push(`\nКонтекст:\n${manager.context}`);
  if (manager.director_request) profileLines.push(`\nЗапрос от директора:\n${manager.director_request}`);
  if (manager.strengths) profileLines.push(`\nСильные стороны:\n${manager.strengths}`);
  if (manager.weaknesses) profileLines.push(`\nСлабые стороны / зоны роста:\n${manager.weaknesses}`);
  if (manager.consultant_comments) profileLines.push(`\nЗаметки консультанта:\n${manager.consultant_comments}`);
  sections.push(profileLines.join('\n'));

  // Layer 3: AI rules (if set)
  if (manager.ai_rules) {
    sections.push(`\n=== ПРАВИЛА РАБОТЫ С ЭТИМ РУКОВОДИТЕЛЕМ ===\n${manager.ai_rules}`);
  }

  // Layer 4: Development track
  if (trackContent) {
    sections.push(`\n=== ТРЕК РАЗВИТИЯ (ИСТОРИЯ СЕССИЙ И НАКОПЛЕННЫЙ КОНТЕКСТ) ===\n${trackContent}`);
  } else {
    sections.push(`\n=== ТРЕК РАЗВИТИЯ ===\nТрек ещё не заполнен. Это первые сессии с данным руководителем.`);
  }

  // Layer 5: Company chronology (kept for backward compat — also included in companyDocs)
  if (chronologyContent) {
    sections.push(`\n=== ХРОНОЛОГИЯ СОБЫТИЙ КОМПАНИИ ===\n${chronologyContent}`);
  }

  // Layer 6: All company documents
  if (companyDocs && companyDocs.length > 0) {
    const docsText = companyDocs
      .map((d) => `--- ${d.title} (${d.type}) ---\n${d.content}`)
      .join('\n\n');
    sections.push(`\n=== ДОКУМЕНТЫ КОМПАНИИ ===\n${docsText}`);
  }

  return sections.join('\n');
}
