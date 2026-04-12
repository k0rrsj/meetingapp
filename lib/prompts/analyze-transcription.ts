export function buildAnalyzeTranscriptionPrompt(
  transcriptionText: string,
  previousContextText: string | null,
  managerProfile: {
    name: string;
    position: string | null;
    context: string | null;
  }
): { system: string; user: string } {
  const system = `Ты — помощник управленческого консультанта. Проанализируй расшифровку встречи one-to-one и верни структурированный JSON-анализ.

КРИТИЧЕСКИ ВАЖНО: верни ТОЛЬКО валидный JSON-объект. Никакого текста до или после. Никаких markdown-блоков \`\`\`. Только сам JSON-объект, начинающийся с { и заканчивающийся }.

Формат ответа:
{
  "key_facts": "...",
  "problems_signals": "...",
  "conclusions": "...",
  "strengths": "...",
  "weaknesses": "...",
  "action_plan": "...",
  "next_scenario": "..."
}

Описание полей:
- key_facts: ключевые факты и темы, которые обсуждались на встрече (3-7 пунктов списком)
- problems_signals: выявленные проблемы, риски, тревожные сигналы
- conclusions: главные выводы консультанта по итогам встречи
- strengths: сильные стороны руководителя, проявившиеся на этой встрече
- weaknesses: слабые стороны или зоны роста, проявившиеся на этой встрече
- action_plan: конкретные шаги и договорённости (кто, что, к когда)
- next_scenario: рекомендуемые темы и вопросы для следующей встречи

Язык: русский. Стиль: деловой, конкретный, без воды.`;

  const profileParts = [
    `Имя: ${managerProfile.name}`,
    managerProfile.position ? `Должность: ${managerProfile.position}` : null,
    managerProfile.context ? `Контекст: ${managerProfile.context}` : null,
  ].filter(Boolean).join('\n');

  const user = `Профиль руководителя:
${profileParts}

${previousContextText ? `Контекст предыдущих встреч:\n${previousContextText}\n\n` : ''}Расшифровка встречи:
${transcriptionText}

Проанализируй расшифровку и верни JSON.`;

  return { system, user };
}
