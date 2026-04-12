import { TRACK_V1_BANNER } from './section-ids';

export interface TrackTemplateVars {
  managerName: string;
  position: string;
  companyName: string;
  consultantName: string;
  createdDateRu: string;
}

/**
 * Full v1 track skeleton: fixed headings + `<!-- track:section:... -->` bodies for server-side merge.
 */
export function buildStructuredTrackMarkdown(vars: TrackTemplateVars): string {
  const {
    managerName,
    position,
    companyName,
    consultantName,
    createdDateRu,
  } = vars;

  return `${TRACK_V1_BANNER}

<!-- track:section:header -->
Трек развития — ${managerName} — ${position || 'должность не указана'}
Навигационный документ менторского трека
Компания: ${companyName}
Консультант: ${consultantName}
Дата создания: ${createdDateRu}
Версия: 1.0

<!-- track:section:profile -->
## Раздел 1. Профиль и контекст

_Заполняется по мере сессий (роль, подчинение, зона ответственности, контекст входа, стейкхолдеры)._

<!-- track:section:chronology -->
## Раздел 2. Хронология сессий и ключевых событий

_После каждой закрытой встречи сюда добавляется краткая запись с датой._

<!-- track:section:patterns -->
## Раздел 3. Выявленные паттерны мышления и поведения

### 3.1. Устойчивые паттерны

### 3.2. Паттерны в процессе изменения

### 3.3. Слепые зоны

<!-- track:section:beliefs -->
## Раздел 4. Установки и убеждения

### 4.1. Текущие установки

### 4.2. Целевые установки

<!-- track:section:progress -->
## Раздел 5. Сдвиги и прогресс

_Шкала 0 → 5 по ключевым осям._

<!-- track:section:people -->
## Раздел 6. Ключевые люди в орбите

<!-- track:section:tools -->
## Раздел 7. Инструменты и фреймворки (применённые и планируемые)

<!-- track:section:risks -->
## Раздел 8. Риски и красные флаги

<!-- track:section:priorities -->
## Раздел 9. Приоритеты на ближайший период

<!-- track:section:metrics -->
## Раздел 10. Метрики прогресса

### 10.1. Поведенческие индикаторы

### 10.2. Результатные индикаторы

### 10.3. Маркеры регресса

<!-- track:section:open_questions -->
## Раздел 11. Открытые вопросы и гипотезы

### 11.1. Открытые вопросы

### 11.2. Гипотезы для проверки

<!-- track:section:footer -->
—
Документ является живой оперативной памятью трека. Обновляется после каждой значимой сессии, встречи или события.
`;
}
