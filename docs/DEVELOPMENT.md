# DEVELOPMENT — Руководство разработчика Meeting Intelligence App

**Версия:** 1.0  
**Дата:** 06.04.2026

---

## 1. Предварительные требования

- Node.js 18+ (`node --version`)
- npm или pnpm
- Аккаунт [Supabase](https://supabase.com) (бесплатный tier достаточен)
- Аккаунт [Vercel](https://vercel.com) (бесплатный tier достаточен)
- Аккаунт [OpenRouter](https://openrouter.ai) + API ключ

---

## 2. Инициализация проекта

### 2.1 Создание Next.js приложения

```bash
npx create-next-app@latest cursorapp \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd cursorapp
```

### 2.2 Установка зависимостей

```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr

# shadcn/ui (инициализация)
npx shadcn@latest init

# При инициализации выбрать:
# Style: Default
# Base color: Neutral
# CSS variables: Yes

# Установить нужные компоненты shadcn/ui
npx shadcn@latest add button input label card badge
npx shadcn@latest add accordion textarea separator
npx shadcn@latest add alert toast dropdown-menu
npx shadcn@latest add select progress

# Парсинг DOCX
npm install mammoth

# Утилиты
npm install date-fns
```

### 2.3 Структура папок

Создать папки вручную:

```bash
mkdir -p lib/supabase lib/openrouter lib/prompts
mkdir -p types
mkdir -p components/companies components/managers
mkdir -p components/meetings components/comments components/shared
mkdir -p app/\(auth\)/login
mkdir -p app/\(dashboard\)/companies
mkdir -p app/\(dashboard\)/settings
mkdir -p "app/api/companies/[id]"
mkdir -p "app/api/managers/[id]/meetings"
mkdir -p "app/api/meetings/[id]/status"
mkdir -p app/api/comments
mkdir -p "app/api/ai/generate-scenario" "app/api/ai/generate-prompt"
mkdir -p app/api/ai/models app/api/ai/settings
mkdir -p app/api/files/upload
mkdir -p supabase/migrations
mkdir -p docs
```

---

## 3. Настройка Supabase

### 3.1 Создание проекта

1. Перейти на [supabase.com](https://supabase.com) → New Project
2. Выбрать регион (Europe — Frankfurt для минимального latency из РФ)
3. Сохранить `Project URL` и ключи

### 3.2 Получение ключей

В Supabase Dashboard → **Settings → API**:

| Переменная | Где взять |
|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` ключ |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` ключ (секретный!) |

### 3.3 Применение миграций

В Supabase Dashboard → **SQL Editor**:

1. Открыть и выполнить `supabase/migrations/001_initial_schema.sql`
2. Открыть и выполнить `supabase/migrations/002_rls_policies.sql`
3. Открыть и выполнить `supabase/migrations/003_storage_policies.sql`

Или через Supabase CLI (если установлен):

```bash
npx supabase db push
```

### 3.4 Создание пользователей

В Supabase Dashboard → **Authentication → Users → Add user**:

**Пользователь 1 (Даниил — консультант):**
- Email: `daniil@yourdomain.com`
- Password: (сгенерировать безопасный)
- User metadata: `{ "role": "consultant", "name": "Даниил" }`

**Пользователь 2 (Саша — ассистент):**
- Email: `sasha@yourdomain.com`
- Password: (сгенерировать безопасный)
- User metadata: `{ "role": "assistant", "name": "Саша" }`

### 3.5 Настройка Storage

В Supabase Dashboard → **Storage**:
- Bucket `transcriptions` должен быть создан миграцией `003_storage_policies.sql`
- Убедиться, что bucket помечен как **private** (не public)

---

## 4. Переменные окружения

### Файл `.env.local` (локальная разработка, не коммитить в git)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...

# App URL (для OpenRouter заголовков)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Файл `.env.example` (коммитится в git — только имена переменных)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
NEXT_PUBLIC_APP_URL=
```

### Добавить `.env.local` в `.gitignore`

```bash
echo ".env.local" >> .gitignore
```

---

## 5. Создание Supabase-клиентов

### `lib/supabase/client.ts` — для браузера

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### `lib/supabase/server.ts` — для Server Components и API Routes

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### `middleware.ts` — в корне проекта

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

---

## 6. Локальный запуск

```bash
npm run dev
```

Приложение доступно на [http://localhost:3000](http://localhost:3000).

---

## 7. Деплой на Vercel

### 7.1 Подключение репозитория

1. Закоммитить код в Git (GitHub, GitLab, Bitbucket)
2. Зайти на [vercel.com](https://vercel.com) → New Project → Import Repository
3. Выбрать репозиторий, Framework Preset = **Next.js** (определяется автоматически)

### 7.2 Переменные окружения в Vercel

В Vercel Dashboard → Project → **Settings → Environment Variables** добавить:

```
NEXT_PUBLIC_SUPABASE_URL      = https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
SUPABASE_SERVICE_ROLE_KEY     = eyJ...
OPENROUTER_API_KEY            = sk-or-v1-...
NEXT_PUBLIC_APP_URL           = https://your-app.vercel.app
```

### 7.3 Деплой

Нажать **Deploy**. Каждый пуш в `main` ветку автоматически деплоится.

---

## 8. Полезные команды

```bash
# Запуск в dev-режиме
npm run dev

# Сборка для production
npm run build

# Проверка TypeScript-ошибок
npx tsc --noEmit

# Линтинг
npm run lint

# Добавить компонент shadcn/ui
npx shadcn@latest add <component-name>
```

---

## 9. Структура проекта (итоговая)

```
cursorapp/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── companies/page.tsx
│   │   ├── companies/[companyId]/managers/page.tsx
│   │   ├── companies/[companyId]/managers/[managerId]/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── auth/login/route.ts
│   │   ├── auth/logout/route.ts
│   │   ├── auth/me/route.ts
│   │   ├── companies/route.ts
│   │   ├── companies/[id]/route.ts
│   │   ├── companies/[id]/managers/route.ts
│   │   ├── managers/[id]/route.ts
│   │   ├── managers/[id]/meetings/route.ts
│   │   ├── meetings/[id]/route.ts
│   │   ├── meetings/[id]/status/route.ts
│   │   ├── comments/route.ts
│   │   ├── comments/[id]/route.ts
│   │   ├── ai/generate-scenario/route.ts
│   │   ├── ai/generate-prompt/route.ts
│   │   ├── ai/models/route.ts
│   │   ├── ai/settings/route.ts
│   │   └── files/upload/route.ts
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                    (shadcn/ui)
│   ├── companies/
│   ├── managers/
│   ├── meetings/
│   ├── comments/
│   └── shared/
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   ├── openrouter/client.ts
│   └── prompts/
├── types/index.ts
├── supabase/migrations/
├── docs/
├── middleware.ts
├── .env.local             (не в git)
├── .env.example
└── ...config files
```

---

## 10. Частые проблемы

| Проблема | Решение |
|---------|---------|
| `TypeError: cookies() is deprecated` | Обновить `@supabase/ssr` до последней версии |
| RLS блокирует запросы | Проверить, что все политики применены (`002_rls_policies.sql`) |
| AI не генерирует | Проверить `OPENROUTER_API_KEY` в Vercel env vars |
| Файл не загружается | Проверить Storage policies (`003_storage_policies.sql`) и что bucket = `transcriptions` |
| `NEXT_PUBLIC_*` не работает на сервере | Эти переменные — только для браузера, серверные читать без префикса |
