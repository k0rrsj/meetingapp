import { TRACK_SECTION_IDS } from '@/lib/track/section-ids';

const ALLOWED = TRACK_SECTION_IDS.join(', ');

export function buildTrackSyncPrompt(params: {
  managerName: string;
  meetingDate: string;
  meetingNumber: number;
  transcriptionText: string | null;
  keyFacts: string | null;
  problemsSignals: string | null;
  conclusions: string | null;
  strengths: string | null;
  weaknesses: string | null;
  actionPlan: string | null;
  /** Truncated excerpt of current track for context */
  trackExcerpt: string;
}): { system: string; user: string } {
  const system = `Ты — аналитик менторского сопровождения. По материалам закрытой встречи подготовь дельты для навигационного трека развития руководителя.

ЖЁСТКИЕ ПРАВИЛА:
- Не предлагай переписать весь документ целиком. Обновляй только через список updates.
- Верни строго валидный JSON без markdown-обёртки:
{
  "updates": [
    { "sectionId": "<id>", "mode": "append" | "replace", "markdown": "<markdown фрагмент>" }
  ]
}
- sectionId ТОЛЬКО из списка: ${ALLOWED}
- mode "append" — по умолчанию для chronology, patterns, people, risks, priorities, metrics, open_questions, tools, progress, beliefs.
- mode "replace" — допустим для header (версия/дата) и для небольших секций, если нужно заменить одну строку-заглушку целиком.
- markdown: русский язык, маркированные списки, подзаголовки ### внутри секции. НЕ используй ## (заголовки разделов зафиксированы в шаблоне).
- Заполняй максимально глубоко по данным встречи: если есть факты — добавь в chronology развёрнутый блок; в patterns / beliefs / people / risks / priorities — всё, что следует из материалов (не одно предложение, а структурированные списки).
- Если данных для секции нет — не включай её в updates.
- Для chronology почти всегда: append блок с датой встречи, 5–12 предложений о сути, договорённостях и динамике.
- Не выдумывай факты, которых нет в материалах.`;

  const user = `Руководитель: ${params.managerName}
Встреча №${params.meetingNumber}, дата: ${params.meetingDate}

Материалы встречи:

## Расшифровка
${params.transcriptionText?.trim() || '(нет)'}

## Ключевые факты
${params.keyFacts?.trim() || '(нет)'}

## Проблемы и сигналы
${params.problemsSignals?.trim() || '(нет)'}

## Выводы
${params.conclusions?.trim() || '(нет)'}

## Сильные стороны
${params.strengths?.trim() || '(нет)'}

## Зоны роста
${params.weaknesses?.trim() || '(нет)'}

## План действий
${params.actionPlan?.trim() || '(нет)'}

---

Фрагмент текущего трека (для контекста, не дублируй уже сказанное):
${params.trackExcerpt}

Верни JSON с массивом updates.`;

  return { system, user };
}

export function truncateTrackForPrompt(full: string, maxChars: number): string {
  if (full.length <= maxChars) return full;
  return `${full.slice(0, maxChars)}\n\n[…фрагмент обрезан…]`;
}

const SYNTH_ALLOWED = TRACK_SECTION_IDS.join(', ');

/** Full-track synthesis from all meeting materials (replace-heavy). */
export function buildTrackSynthesizeFromHistoryPrompt(params: {
  managerName: string;
  companyName: string;
  position: string | null;
  managerProfileBlock: string;
  meetingsArchive: string;
}): { system: string; user: string } {
  const system = `Ты — ведущий консультант по менторскому сопровождению руководителей. Тебе передали архив встреч и профиль руководителя.

Задача: составить ПОЛНОЕ наполнение навигационного трека развития уровня детальности внутреннего консультантского документа (оперативная память трека): не заготовки, а содержательный текст по каждому разделу, опираясь только на переданные материалы.

Формат ответа — строго валидный JSON без markdown-обёртки:
{
  "updates": [
    { "sectionId": "<id>", "mode": "replace", "markdown": "<содержимое тела секции>" }
  ]
}

sectionId ТОЛЬКО из списка: ${SYNTH_ALLOWED}

Режим: почти везде используй mode "replace", чтобы заменить текст-заглушку шаблона целиком на развёрнутое содержимое.

Требования к содержимому секций:
- header: строки как в шаблоне (трек развития — ФИО — роль, компания, консультант из контекста если есть, дата последней синхронизации сегодняшняя по данным запроса, версия 1.1 или подобное).
- profile: роль, контекст, зона ответственности, стейкхолдеры, вход в трек — структурировано, списки.
- chronology: по каждой встрече из архива — подзаголовок с датой/номером и сжатый но содержательный пересказ ключевых событий и сдвигов.
- patterns: подпункты ### 3.1 / ### 3.2 / ### 3.3 с маркированными списками; если мало данных — коротко и честно.
- beliefs: ### 4.1 текущие установки, ### 4.2 целевые — из материалов.
- progress: шкалы 0→5 по нескольким осям с кратким обоснованием цифр из фактов.
- people: ключевые фигуры и дельта по каждому.
- tools: какие фреймворки упоминались / что планировать.
- risks: с уровнем серьёзности где уместно.
- priorities: период и конкретные приоритеты из планов и выводов.
- metrics: подразделы 10.1–10.3 со списками индикаторов.
- open_questions: 11.1 вопросы, 11.2 гипотезы.
- footer: короткий абзац про «живой документ».

Не используй внутри markdown заголовки уровня ## (они зафиксированы вне твоего ввода). Внутри секций — ###, списки, жирный текст где уместно.

Если по разделу почти нет фактов — 2–4 предложения «в материалах недостаточно оснований», без выдумок.

Объём: секции должны быть содержательными (несколько абзацев там, где данных достаточно).`;

  const user = `Руководитель: ${params.managerName}
Должность: ${params.position?.trim() || 'не указана'}
Компания: ${params.companyName}

## Профиль и карточка (из системы)
${params.managerProfileBlock}

---

## Архив встреч (все доступные материалы)
${params.meetingsArchive}

---

Верни JSON с массивом updates: заполни все релевантные секции (минимум: chronology, profile, patterns, people; остальные — по наличию данных).`;

  return { system, user };
}

