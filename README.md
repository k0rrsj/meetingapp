# Meeting Intelligence App

Веб-приложение для управленческого консультанта. Автоматизирует цикл работы со встречами: сценарий → встреча → расшифровка → анализ → следующий шаг.

## Быстрый старт

### 1. Настроить переменные окружения

Скопировать `.env.example` в `.env.local` и заполнить:

```bash
# Supabase — https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic — https://console.anthropic.com/
ANTHROPIC_API_KEY=

# URL приложения
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Настроить базу данных Supabase

В **Supabase Dashboard → SQL Editor** выполнить по порядку:

Выполните **все** файлы из `supabase/migrations/` по возрастанию номера (001, 002, …), например:

1. `001_initial_schema.sql`
2. `002_rls_policies.sql`
3. `003_storage_policies.sql`
4. далее `004_*.sql`, `005_*.sql` и т.д., если они есть в репозитории

### 3. Создать пользователей

В **Supabase Dashboard → Authentication → Users → Add user**:

**Даниил (консультант):**
- Email: `daniil@yourdomain.com`
- User metadata: `{ "role": "consultant", "name": "Даниил" }`

**Саша (ассистент):**
- Email: `sasha@yourdomain.com`
- User metadata: `{ "role": "assistant", "name": "Саша" }`

### 4. Запустить

```bash
npm install
npm run dev
```

Приложение: [http://localhost:3000](http://localhost:3000)

## Деплой на Vercel (публичная ссылка)

1. Закоммитьте проект и отправьте в **GitHub** / **GitLab** / **Bitbucket** (или используйте `vercel link` из папки проекта).
2. Зайдите на [vercel.com](https://vercel.com) → **Add New** → **Project** → импортируйте репозиторий.
3. **Framework Preset:** Next.js (по умолчанию). **Build:** `npm run build`, **Output:** по умолчанию.
4. В **Settings → Environment Variables** добавьте для **Production** (и при необходимости Preview) те же переменные, что в `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_APP_URL` = URL прод-сайта, например `https://ваш-проект.vercel.app` (после первого деплоя скопируйте домен из Vercel и обновите переменную при необходимости).
   - при использовании Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
5. Нажмите **Deploy**. После сборки приложение будет доступно по ссылке вида `https://<имя-проекта>.vercel.app`.

### Supabase после деплоя

В [Supabase Dashboard](https://supabase.com/dashboard) → ваш проект → **Authentication** → **URL configuration**:

- **Site URL:** укажите прод-URL (`https://....vercel.app`) или оставьте основной домен, с которым заходят пользователи.
- **Redirect URLs:** добавьте `https://....vercel.app/**` и при необходимости `http://localhost:3000/**` для локальной разработки.

Иначе сессии и cookies могут вести себя некорректно вне localhost.

### Деплой из терминала (по желанию)

```bash
npx vercel login
npx vercel --prod
```

Следуйте подсказкам CLI; переменные окружения можно задать в интерфейсе Vercel или через `vercel env pull`.

## Структура проекта

```
app/
  (auth)/login/         — страница входа
  (dashboard)/
    companies/          — список компаний
    companies/[id]/managers/         — руководители
    companies/[id]/managers/[id]/    — карточка руководителя + история встреч
    settings/           — настройки AI (только консультант)
  api/                  — REST API endpoints

components/
  companies/    — карточки компаний
  managers/     — профиль, история встреч
  meetings/     — карточка встречи, статус
  comments/     — комментарии
  shared/       — навигация, хлебные крошки, AI-кнопка

lib/
  supabase/     — клиенты для браузера и сервера
  openrouter/   — клиент OpenRouter API
  prompts/      — системные промпты для AI
```

## Роли

| Действие | Консультант | Ассистент |
|----------|-------------|-----------|
| Добавить компанию/руководителя | — | ✓ |
| Создать встречу | — | ✓ |
| Заполнять поля встречи | — | ✓ |
| Редактировать «Комментарии Даниила» | ✓ | — |
| Оставлять комментарии | ✓ | ✓ |
| Генерация AI | ✓ | ✓ |
| Настройки AI | ✓ | — |
