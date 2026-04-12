# ARCHITECTURE — Техническая архитектура Meeting Intelligence App

**Версия:** 1.0  
**Дата:** 06.04.2026

---

## 1. Обзор системы

```
┌─────────────────────────────────────────────────────────────┐
│                         БРАУЗЕР                             │
│              Next.js (React, App Router)                    │
│         Tailwind CSS + shadcn/ui компоненты                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│                    VERCEL (Edge/Serverless)                  │
│                  Next.js API Routes                         │
│              Middleware (Auth check + RBAC)                 │
└──────┬──────────────────────────────────────┬───────────────┘
       │                                      │
       ▼                                      ▼
┌──────────────────┐                 ┌────────────────────────┐
│    SUPABASE      │                 │   OPENROUTER API       │
│                  │                 │                        │
│  PostgreSQL DB   │                 │  GPT-4o, Claude,       │
│  Supabase Auth   │                 │  Gemini и др.          │
│  Storage (files) │                 │                        │
│  Row Level Sec.  │                 └────────────────────────┘
└──────────────────┘
```

---

## 2. Технологический стек

### Frontend

| Технология | Версия | Назначение |
|-----------|--------|-----------|
| Next.js | 14+ | Fullstack фреймворк (App Router, SSR/CSR) |
| React | 18+ | UI-библиотека |
| TypeScript | 5+ | Типизация |
| Tailwind CSS | 3+ | Утилитарный CSS |
| shadcn/ui | latest | Готовые UI-компоненты (Radix UI + Tailwind) |

### Backend (встроен в Next.js)

| Технология | Версия | Назначение |
|-----------|--------|-----------|
| Next.js API Routes | 14+ | Серверные обработчики запросов |
| Supabase JS Client | 2+ | Работа с БД и Storage |

### База данных и инфраструктура

| Технология | Назначение |
|-----------|-----------|
| Supabase (PostgreSQL) | Основная БД |
| Supabase Auth | Аутентификация (email/password) |
| Supabase Storage | Хранение файлов расшифровок |
| Supabase RLS | Безопасность на уровне строк |

### Интеграции

| Сервис | Назначение |
|--------|-----------|
| OpenRouter API | AI-генерация (сценарии, контекст, промпты) |

### Деплой

| Сервис | Назначение |
|--------|-----------|
| Vercel | Хостинг Next.js (serverless functions) |

---

## 3. Архитектура Next.js (App Router)

### 3.1 Разделение Server / Client компонентов

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx              ← Server Component (читает сессию)
│
└── (dashboard)/
    ├── layout.tsx                ← Server Component (проверка auth)
    ├── companies/
    │   ├── page.tsx              ← Server Component (fetch данных)
    │   └── [companyId]/
    │       └── managers/
    │           ├── page.tsx      ← Server Component
    │           └── [managerId]/
    │               └── page.tsx  ← Server Component
    │
    └── settings/
        └── page.tsx              ← Client Component (форма настроек AI)
```

**Правило:** Данные загружаются в Server Components через прямые запросы к Supabase (не через API Routes). API Routes используются только для мутаций (POST, PATCH, DELETE) и AI-запросов.

### 3.2 Паттерн загрузки данных

```typescript
// Server Component — прямой запрос к Supabase
// app/(dashboard)/companies/page.tsx
import { createServerClient } from '@/lib/supabase/server';

export default async function CompaniesPage() {
  const supabase = createServerClient();
  const { data: companies } = await supabase
    .from('companies')
    .select('*, managers(count), meetings(date)')
    .order('name');

  return <CompaniesList companies={companies} />;
}
```

```typescript
// Client Component — для интерактивности
// components/meetings/MeetingCard.tsx
'use client';
import { useState } from 'react';

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // ...
}
```

### 3.3 Middleware (Auth + RBAC)

```typescript
// middleware.ts — выполняется на каждый запрос
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { data: { session } } = await supabase.auth.getSession();

  // Защита всех маршрутов кроме /login
  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 4. Архитектура базы данных (Supabase)

### 4.1 Схема связей

```
users (Supabase Auth)
  │
  └── user_profiles (role, name)

companies
  │
  └── managers (company_id FK)
        │
        ├── meetings (manager_id FK)
        │     │
        │     └── comments (target_type='meeting', target_id FK)
        │
        └── comments (target_type='manager', target_id FK)

ai_settings (user_id FK → users)
```

### 4.2 Supabase Storage

```
bucket: transcriptions (private, RLS включён)
  policy: только аутентифицированные пользователи

структура файлов:
  /{manager_id}/{meeting_id}/transcription.{txt|docx}
```

---

## 5. AI-интеграция (OpenRouter)

### 5.1 Поток данных

```
Browser (нажатие кнопки "Сгенерировать")
  │
  ▼
POST /api/ai/generate-scenario
  │
  ├── Получить ai_settings пользователя из Supabase
  ├── Сформировать промпт из шаблона + контекст встречи
  │
  ▼
OpenRouter API (HTTPS, сервер → сервер)
  │
  ▼
Ответ → сохранить в meetings.scenario
  │
  ▼
Browser получает результат (streaming или single response)
```

### 5.2 Безопасность

- `OPENROUTER_API_KEY` — только на сервере (env variable), никогда не в клиентском коде
- Все запросы к OpenRouter идут через Next.js API Routes, не с браузера напрямую

---

## 6. Аутентификация

### 6.1 Поток входа

```
Browser → POST /login (email, password)
  │
  ▼
Supabase Auth → JWT токен
  │
  ├── Токен сохраняется в httpOnly cookie (Supabase SDK делает автоматически)
  │
  ▼
Browser → редирект на /companies
```

### 6.2 Проверка сессии

- Server Components используют `createServerClient()` — читает cookie напрямую
- API Routes используют `createRouteHandlerClient()` — то же самое
- Middleware использует `createMiddlewareClient()` — обновляет cookie при необходимости

---

## 7. Структура папок проекта

```
cursorapp/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── companies/
│   │   │   ├── page.tsx
│   │   │   └── [companyId]/
│   │   │       └── managers/
│   │   │           ├── page.tsx
│   │   │           └── [managerId]/
│   │   │               └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── api/
│   │   ├── companies/
│   │   │   ├── route.ts                  (GET, POST)
│   │   │   └── [id]/
│   │   │       └── route.ts              (PATCH)
│   │   ├── managers/
│   │   │   ├── route.ts                  (POST)
│   │   │   └── [id]/
│   │   │       ├── route.ts              (GET, PATCH)
│   │   │       └── meetings/
│   │   │           └── route.ts          (GET, POST)
│   │   ├── meetings/
│   │   │   └── [id]/
│   │   │       ├── route.ts              (GET, PATCH)
│   │   │       └── status/
│   │   │           └── route.ts          (PATCH)
│   │   ├── comments/
│   │   │   └── route.ts                  (GET, POST)
│   │   ├── ai/
│   │   │   ├── generate-context/
│   │   │   │   └── route.ts
│   │   │   ├── generate-scenario/
│   │   │   │   └── route.ts
│   │   │   ├── generate-prompt/
│   │   │   │   └── route.ts
│   │   │   ├── models/
│   │   │   │   └── route.ts
│   │   │   └── settings/
│   │   │       └── route.ts
│   │   └── files/
│   │       └── upload/
│   │           └── route.ts
│   ├── globals.css
│   └── layout.tsx
│
├── components/
│   ├── ui/                               (shadcn/ui компоненты)
│   ├── companies/
│   │   ├── CompanyCard.tsx
│   │   └── CompaniesList.tsx
│   ├── managers/
│   │   ├── ManagerCard.tsx
│   │   ├── ManagersList.tsx
│   │   ├── ManagerProfile.tsx
│   │   └── MeetingHistory.tsx
│   ├── meetings/
│   │   ├── MeetingCard.tsx
│   │   ├── MeetingForm.tsx
│   │   ├── StatusBadge.tsx
│   │   └── FileUpload.tsx
│   ├── comments/
│   │   ├── CommentsList.tsx
│   │   └── CommentForm.tsx
│   └── shared/
│       ├── Navigation.tsx
│       ├── Breadcrumbs.tsx
│       └── AiGenerateButton.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     (браузерный клиент)
│   │   ├── server.ts                     (серверный клиент)
│   │   └── middleware.ts                 (middleware клиент)
│   ├── openrouter/
│   │   └── client.ts                     (OpenRouter запросы)
│   ├── prompts/
│   │   ├── scenario.ts                   (системные промпты)
│   │   ├── context.ts
│   │   └── transcription-prompt.ts
│   └── utils.ts
│
├── types/
│   └── index.ts                          (все TypeScript типы)
│
├── supabase/
│   └── migrations/                       (SQL файлы миграций)
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       └── 003_storage_policies.sql
│
├── docs/                                 (проектная документация)
│   ├── PRD.md
│   ├── SERVICE_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SCREENS.md
│   ├── ROADMAP.md
│   └── DEVELOPMENT.md
│
├── .env.local                            (локальные env, не в git)
├── .env.example                          (шаблон env, в git)
├── middleware.ts
├── next.config.ts
├── tailwind.config.ts
├── components.json                       (shadcn/ui конфиг)
└── tsconfig.json
```

---

## 8. Переменные окружения

```bash
# .env.example

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # только серверный код

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Правило именования:**
- `NEXT_PUBLIC_*` — доступны в браузере (не хранить секреты!)
- Без префикса — только сервер

---

## 9. Решения по архитектуре и их обоснование

| Решение | Альтернатива | Причина выбора |
|---------|-------------|----------------|
| Next.js (fullstack) | React + отдельный API | Меньше инфраструктуры, единый деплой на Vercel |
| Supabase | PostgreSQL на VPS | Managed DB + Auth + Storage из коробки, нет DevOps |
| Supabase Auth | NextAuth.js | Интегрирован с Supabase DB и RLS |
| shadcn/ui | MUI, Ant Design | Не библиотека, а компоненты в коде — полный контроль |
| Server Components для чтения | API Routes везде | Меньше round-trips, данные сразу в HTML |
| OpenRouter | Прямо OpenAI API | Гибкость: переключение между моделями без смены кода |
