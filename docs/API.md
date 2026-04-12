# API — Контракты Meeting Intelligence App

**Версия:** 1.0  
**Дата:** 06.04.2026  
**Base URL:** `/api`

---

## Общие соглашения

- Все запросы требуют авторизации (сессионный cookie Supabase Auth)
- Тело запроса и ответа — JSON (`Content-Type: application/json`)
- Ошибки возвращают стандартный формат:
  ```json
  { "error": "Описание ошибки" }
  ```
- UUID-идентификаторы во всех ресурсах
- Timestamps в формате ISO 8601

---

## Auth

### POST /api/auth/login
Вход в систему.

**Request:**
```json
{
  "email": "daniil@example.com",
  "password": "secret"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "daniil@example.com",
    "role": "consultant",
    "name": "Даниил"
  }
}
```

**Response 401:**
```json
{ "error": "Неверный email или пароль" }
```

---

### POST /api/auth/logout
Выход из системы.

**Response 200:**
```json
{ "success": true }
```

---

### GET /api/auth/me
Информация о текущем пользователе.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "daniil@example.com",
  "role": "consultant",
  "name": "Даниил"
}
```

---

## Companies

### GET /api/companies
Список всех компаний с агрегированными метриками.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "name": "ООО Альфа",
    "status": "active",
    "active_managers_count": 5,
    "last_meeting_date": "2026-04-01",
    "total_meetings_count": 23,
    "closed_meetings_count": 20,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-04-01T00:00:00Z"
  }
]
```

---

### POST /api/companies
Создание компании. Только для `assistant`.

**Request:**
```json
{
  "name": "ООО Бета"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "name": "ООО Бета",
  "status": "active",
  "created_at": "2026-04-06T10:00:00Z",
  "updated_at": "2026-04-06T10:00:00Z"
}
```

**Response 403:** (если роль не `assistant`)
```json
{ "error": "Недостаточно прав" }
```

---

### PATCH /api/companies/:id
Обновление компании (название, статус). Только для `assistant`.

**Request:**
```json
{
  "name": "ООО Бета Новая",
  "status": "completed"
}
```

**Response 200:** обновлённый объект компании

---

## Managers

### GET /api/companies/:companyId/managers
Список руководителей компании с метриками.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "company_id": "uuid",
    "name": "Иван Петров",
    "position": "Директор по маркетингу",
    "role_in_team": "Ключевой игрок",
    "work_type": "one_to_one",
    "status": "in_progress",
    "meetings_count": 4,
    "last_meeting_date": "2026-03-28",
    "created_at": "2026-01-15T00:00:00Z",
    "updated_at": "2026-03-28T00:00:00Z"
  }
]
```

---

### POST /api/companies/:companyId/managers
Создание руководителя. Только для `assistant`.

**Request:**
```json
{
  "name": "Иван Петров",
  "position": "Директор по маркетингу",
  "role_in_team": "Ключевой игрок",
  "context": "Давно в компании, опытный...",
  "director_request": "Развить навык делегирования",
  "strengths": "Стратегическое мышление",
  "weaknesses": "Микроменеджмент",
  "work_type": "one_to_one"
}
```

**Response 201:** полный объект руководителя

---

### GET /api/managers/:id
Полный профиль руководителя + история встреч.

**Response 200:**
```json
{
  "id": "uuid",
  "company_id": "uuid",
  "name": "Иван Петров",
  "position": "Директор по маркетингу",
  "role_in_team": "Ключевой игрок",
  "context": "Давно в компании...",
  "director_request": "Развить делегирование",
  "strengths": "Стратегическое мышление",
  "weaknesses": "Микроменеджмент",
  "work_type": "one_to_one",
  "status": "in_progress",
  "consultant_comments": "Хороший прогресс по делегированию",
  "meetings_count": 4,
  "last_meeting_date": "2026-03-28",
  "meetings": [
    {
      "id": "uuid",
      "meeting_number": 4,
      "date": "2026-03-28",
      "status": "closed"
    }
  ],
  "created_at": "2026-01-15T00:00:00Z",
  "updated_at": "2026-03-28T00:00:00Z"
}
```

---

### PATCH /api/managers/:id
Обновление профиля руководителя.

**Права:**
- `assistant` — все поля кроме `consultant_comments`
- `consultant` — только `consultant_comments`

**Request (assistant):**
```json
{
  "position": "Директор по продукту",
  "context": "Обновлённый контекст...",
  "strengths": "Системное мышление",
  "weaknesses": "Трудно принимает критику"
}
```

**Request (consultant):**
```json
{
  "consultant_comments": "Заметный прогресс за последний квартал"
}
```

**Response 200:** обновлённый объект руководителя

**Response 403:** если consultant пытается изменить защищённые поля

---

## Meetings

### GET /api/managers/:managerId/meetings
Список встреч руководителя в обратном хронологическом порядке.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "manager_id": "uuid",
    "meeting_number": 4,
    "date": "2026-03-28",
    "type": "one_to_one",
    "status": "closed",
    "created_at": "2026-03-20T00:00:00Z"
  }
]
```

---

### POST /api/managers/:managerId/meetings
Создание новой карточки встречи. Только для `assistant`.

Автоматически:
- Определяет номер встречи (`MAX(meeting_number) + 1`)
- Формирует `previous_context` из последней встречи
- Запускает AI-генерацию сценария (если настроен OpenRouter)

**Request:** (тело не обязательно — все поля формируются автоматически)
```json
{}
```

**Response 201:**
```json
{
  "id": "uuid",
  "manager_id": "uuid",
  "meeting_number": 5,
  "date": null,
  "type": "one_to_one",
  "status": "preparation",
  "previous_context_text": "Встреча №4 от 2026-03-28\n\nВЫВОДЫ:\n...",
  "previous_context_json": { "meetingNumber": 4, "date": "2026-03-28", "..." : "..." },
  "context_from_unclosed": false,
  "scenario": "1. Проверить прогресс по делегированию\n...",
  "transcription_prompt": null,
  "created_at": "2026-04-06T10:00:00Z",
  "updated_at": "2026-04-06T10:00:00Z"
}
```

---

### GET /api/meetings/:id
Полная карточка встречи.

**Response 200:** полный объект `Meeting` (все поля из таблицы)

---

### PATCH /api/meetings/:id
Обновление полей карточки встречи. Только для `assistant`.

Разрешённые поля зависят от текущего статуса (см. SERVICE_SPEC.md §2.3).

**Request:**
```json
{
  "date": "2026-04-10",
  "scenario": "Обновлённый сценарий встречи...",
  "transcription_prompt": "Извлеки ключевые факты..."
}
```

**Response 200:** обновлённый объект встречи

**Response 400:** если поле недоступно на текущем статусе
```json
{ "error": "Поле 'scenario' недоступно для редактирования в статусе 'conducted'" }
```

---

### PATCH /api/meetings/:id/status
Смена статуса карточки встречи.

**Request:**
```json
{
  "status": "conducted"
}
```

**Правила переходов:** `preparation → conducted → processed → closed`

**Response 200:**
```json
{
  "id": "uuid",
  "status": "conducted",
  "conducted_at": "2026-04-06T10:00:00Z",
  "updated_at": "2026-04-06T10:00:00Z"
}
```

**Response 400:** невалидный переход
```json
{ "error": "Нельзя перейти из статуса 'closed' в 'preparation'" }
```

**Response 422:** не заполнены обязательные поля (при переходе в `closed`)
```json
{
  "error": "Для закрытия встречи заполните обязательные поля",
  "missing_fields": ["conclusions", "action_plan"]
}
```

---

## Comments

### GET /api/comments
Список комментариев к сущности.

**Query params:**
- `target_type` — `manager` или `meeting`
- `target_id` — UUID сущности

**Example:** `GET /api/comments?target_type=meeting&target_id=uuid`

**Response 200:**
```json
[
  {
    "id": "uuid",
    "target_type": "meeting",
    "target_id": "uuid",
    "user_id": "uuid",
    "text": "Важное наблюдение по коммуникациям",
    "created_at": "2026-04-06T10:00:00Z",
    "updated_at": "2026-04-06T10:00:00Z",
    "user_profile": {
      "id": "uuid",
      "name": "Даниил",
      "role": "consultant"
    }
  }
]
```

---

### POST /api/comments
Добавление комментария. Для обоих пользователей.

**Request:**
```json
{
  "target_type": "meeting",
  "target_id": "uuid",
  "text": "Обратить внимание на конфликт с финансовым отделом"
}
```

**Response 201:** созданный объект комментария

---

### PATCH /api/comments/:id
Редактирование комментария. Только автор.

**Request:**
```json
{
  "text": "Обновлённый текст комментария"
}
```

**Response 200:** обновлённый объект комментария

**Response 403:** если не автор

---

### DELETE /api/comments/:id
Удаление комментария. Только автор.

**Response 204:** (нет тела)

**Response 403:** если не автор

---

## AI

### POST /api/ai/generate-context
Сборка контекстного текста из данных встречи (без вызова AI — только форматирование).

**Request:**
```json
{
  "meeting_id": "uuid"
}
```

**Response 200:**
```json
{
  "context_text": "Встреча №4 от 2026-03-28\n\nВЫВОДЫ:\n...",
  "context_json": { "meetingNumber": 4, "..." : "..." }
}
```

---

### POST /api/ai/generate-scenario
Генерация сценария встречи через OpenRouter.

**Request:**
```json
{
  "meeting_id": "uuid"
}
```

**Response 200:**
```json
{
  "scenario": "1. Проверить прогресс по делегированию...\n2. Обсудить ситуацию с командой..."
}
```

**Response 400:** отсутствует контекст
```json
{ "error": "Для генерации сценария необходим контекст предыдущих встреч" }
```

**Response 503:** ошибка OpenRouter API
```json
{ "error": "Сервис AI временно недоступен. Попробуйте позже" }
```

---

### POST /api/ai/generate-prompt
Генерация промпта для расшифровки через OpenRouter.

**Request:**
```json
{
  "meeting_id": "uuid"
}
```

**Response 200:**
```json
{
  "transcription_prompt": "Проанализируй запись встречи и извлеки:\n1. Ключевые решения..."
}
```

**Response 400:** отсутствует сценарий
```json
{ "error": "Для генерации промпта необходим сценарий встречи" }
```

---

### GET /api/ai/models
Список доступных моделей OpenRouter.

**Response 200:**
```json
{
  "models": [
    { "id": "openai/gpt-4o", "name": "GPT-4o", "context_length": 128000 },
    { "id": "anthropic/claude-3-5-sonnet", "name": "Claude 3.5 Sonnet", "context_length": 200000 },
    { "id": "google/gemini-pro-1.5", "name": "Gemini Pro 1.5", "context_length": 1000000 },
    { "id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "context_length": 128000 }
  ],
  "current_model": "openai/gpt-4o"
}
```

---

### PATCH /api/ai/settings
Обновление настроек AI. Только для `consultant`.

**Request:**
```json
{
  "preferred_model": "anthropic/claude-3-5-sonnet"
}
```

**Response 200:**
```json
{
  "preferred_model": "anthropic/claude-3-5-sonnet",
  "updated_at": "2026-04-06T10:00:00Z"
}
```

---

## Files

### POST /api/files/upload
Загрузка файла расшифровки. Только для `assistant`.

**Request:** `multipart/form-data`
- `file` — файл (txt, docx, макс. 10 МБ)
- `meeting_id` — UUID встречи

**Response 200:**
```json
{
  "file_url": "https://supabase.co/storage/v1/object/transcriptions/...",
  "text_preview": "Первые 200 символов извлечённого текста...",
  "chars_count": 12543
}
```

**Response 400:** неподдерживаемый формат или превышен размер
```json
{ "error": "Поддерживаются только .txt и .docx (макс. 10 МБ)" }
```

---

## HTTP-коды ответов

| Код | Значение |
|-----|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (DELETE) |
| 400 | Bad Request (невалидные данные) |
| 401 | Unauthorized (не авторизован) |
| 403 | Forbidden (нет прав) |
| 404 | Not Found |
| 422 | Unprocessable Entity (бизнес-логика) |
| 503 | Service Unavailable (AI недоступен) |
