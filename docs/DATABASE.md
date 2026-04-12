# DATABASE — Модель данных Meeting Intelligence App

**Версия:** 1.0  
**Дата:** 06.04.2026  
**СУБД:** PostgreSQL (Supabase)

---

## 1. Схема таблиц

### 1.1 `user_profiles`

Расширение стандартной таблицы Supabase Auth. Создаётся автоматически при регистрации пользователя через trigger.

```sql
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('consultant', 'assistant')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 1.2 `companies`

```sql
CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 1.3 `managers`

```sql
CREATE TABLE managers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  position             TEXT,
  role_in_team         TEXT,
  context              TEXT,             -- кто такой, особенности
  director_request     TEXT,             -- что сказали про этого человека
  strengths            TEXT,
  weaknesses           TEXT,
  work_type            TEXT NOT NULL DEFAULT 'one_to_one'
                         CHECK (work_type IN ('one_to_one', 'diagnostics')),
  status               TEXT NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress', 'completed')),
  consultant_comments  TEXT,             -- редактируемое поле Даниила в профиле
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_managers_company_id ON managers(company_id);
```

---

### 1.4 `meetings`

```sql
CREATE TABLE meetings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id                UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  meeting_number            INTEGER NOT NULL,
  date                      DATE,
  type                      TEXT NOT NULL DEFAULT 'one_to_one'
                              CHECK (type IN ('one_to_one', 'diagnostics')),
  status                    TEXT NOT NULL DEFAULT 'preparation'
                              CHECK (status IN ('preparation', 'conducted', 'processed', 'closed')),

  -- Контекст (заполняется автоматически при создании)
  previous_context_text     TEXT,         -- читаемый текст для UI
  previous_context_json     JSONB,        -- структурированный для AI
  context_from_unclosed     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Подготовка
  scenario                  TEXT,
  transcription_prompt      TEXT,

  -- После встречи
  transcription_text        TEXT,
  transcription_file_url    TEXT,

  -- Анализ
  key_facts                 TEXT,
  problems_signals          TEXT,
  conclusions               TEXT,
  strengths                 TEXT,
  weaknesses                TEXT,
  action_plan               TEXT,
  next_scenario             TEXT,

  -- Метаданные
  conducted_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (manager_id, meeting_number)
);

CREATE INDEX idx_meetings_manager_id ON meetings(manager_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_date ON meetings(date DESC);
```

---

### 1.5 `comments`

```sql
CREATE TABLE comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  TEXT NOT NULL CHECK (target_type IN ('manager', 'meeting')),
  target_id    UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
```

---

### 1.6 `ai_settings`

```sql
CREATE TABLE ai_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_model  TEXT NOT NULL DEFAULT 'openai/gpt-4o',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 2. Полная SQL-миграция

### Файл: `supabase/migrations/001_initial_schema.sql`

```sql
-- ============================================================
-- Meeting Intelligence App — Initial Schema
-- ============================================================

-- Trigger: автоматически обновлять updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- user_profiles
-- ============================================================
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('consultant', 'assistant')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Автоматическое создание профиля при регистрации
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'assistant')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- companies
-- ============================================================
CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- managers
-- ============================================================
CREATE TABLE managers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  position             TEXT,
  role_in_team         TEXT,
  context              TEXT,
  director_request     TEXT,
  strengths            TEXT,
  weaknesses           TEXT,
  work_type            TEXT NOT NULL DEFAULT 'one_to_one'
                         CHECK (work_type IN ('one_to_one', 'diagnostics')),
  status               TEXT NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress', 'completed')),
  consultant_comments  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_managers_company_id ON managers(company_id);

CREATE TRIGGER update_managers_updated_at
  BEFORE UPDATE ON managers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- meetings
-- ============================================================
CREATE TABLE meetings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id                UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  meeting_number            INTEGER NOT NULL,
  date                      DATE,
  type                      TEXT NOT NULL DEFAULT 'one_to_one'
                              CHECK (type IN ('one_to_one', 'diagnostics')),
  status                    TEXT NOT NULL DEFAULT 'preparation'
                              CHECK (status IN ('preparation', 'conducted', 'processed', 'closed')),
  previous_context_text     TEXT,
  previous_context_json     JSONB,
  context_from_unclosed     BOOLEAN NOT NULL DEFAULT FALSE,
  scenario                  TEXT,
  transcription_prompt      TEXT,
  transcription_text        TEXT,
  transcription_file_url    TEXT,
  key_facts                 TEXT,
  problems_signals          TEXT,
  conclusions               TEXT,
  strengths                 TEXT,
  weaknesses                TEXT,
  action_plan               TEXT,
  next_scenario             TEXT,
  conducted_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manager_id, meeting_number)
);

CREATE INDEX idx_meetings_manager_id ON meetings(manager_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_date ON meetings(date DESC);

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- comments
-- ============================================================
CREATE TABLE comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  TEXT NOT NULL CHECK (target_type IN ('manager', 'meeting')),
  target_id    UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ai_settings
-- ============================================================
CREATE TABLE ai_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_model  TEXT NOT NULL DEFAULT 'openai/gpt-4o',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. RLS-политики

### Файл: `supabase/migrations/002_rls_policies.sql`

```sql
-- ============================================================
-- Включение RLS на всех таблицах
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- user_profiles
-- ============================================================
-- Читать свой профиль
CREATE POLICY "users_read_own_profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Читать все профили (чтобы отображать имя автора комментария)
CREATE POLICY "users_read_all_profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- companies — все аутентифицированные читают
-- ============================================================
CREATE POLICY "authenticated_read_companies" ON companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "assistant_insert_companies" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

CREATE POLICY "assistant_update_companies" ON companies
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

-- ============================================================
-- managers
-- ============================================================
CREATE POLICY "authenticated_read_managers" ON managers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "assistant_insert_managers" ON managers
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

CREATE POLICY "assistant_update_managers" ON managers
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

-- Consultant может редактировать только consultant_comments
CREATE POLICY "consultant_update_comments_field" ON managers
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'consultant'
  )
  WITH CHECK (true);
-- Примечание: ограничение на уровне конкретных колонок лучше делать
-- через API Route валидацию, а не через RLS (RLS не поддерживает column-level)

-- ============================================================
-- meetings
-- ============================================================
CREATE POLICY "authenticated_read_meetings" ON meetings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "assistant_insert_meetings" ON meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

CREATE POLICY "assistant_update_meetings" ON meetings
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

-- ============================================================
-- comments — все пишут, автор редактирует/удаляет
-- ============================================================
CREATE POLICY "authenticated_read_comments" ON comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_comments" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "author_update_comments" ON comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "author_delete_comments" ON comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- ai_settings — только свои настройки
-- ============================================================
CREATE POLICY "own_ai_settings" ON ai_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## 4. Politики Storage

### Файл: `supabase/migrations/003_storage_policies.sql`

```sql
-- Создание bucket для расшифровок
INSERT INTO storage.buckets (id, name, public)
VALUES ('transcriptions', 'transcriptions', false);

-- Только аутентифицированные пользователи читают файлы
CREATE POLICY "authenticated_read_transcriptions"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'transcriptions');

-- Только ассистент загружает файлы
CREATE POLICY "assistant_upload_transcriptions"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'transcriptions' AND
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

-- Только ассистент удаляет файлы
CREATE POLICY "assistant_delete_transcriptions"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'transcriptions' AND
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );
```

---

## 5. TypeScript-типы

### Файл: `types/index.ts`

```typescript
export type UserRole = 'consultant' | 'assistant';
export type CompanyStatus = 'active' | 'completed';
export type ManagerStatus = 'in_progress' | 'completed';
export type WorkType = 'one_to_one' | 'diagnostics';
export type MeetingStatus = 'preparation' | 'conducted' | 'processed' | 'closed';
export type MeetingType = 'one_to_one' | 'diagnostics';
export type CommentTarget = 'manager' | 'meeting';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
}

export interface Manager {
  id: string;
  company_id: string;
  name: string;
  position: string | null;
  role_in_team: string | null;
  context: string | null;
  director_request: string | null;
  strengths: string | null;
  weaknesses: string | null;
  work_type: WorkType;
  status: ManagerStatus;
  consultant_comments: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreviousContextJson {
  meetingId: string;
  meetingNumber: number;
  date: string | null;
  conclusions: string | null;
  actionPlan: string | null;
  problemsSignals: string | null;
  consultantComments: string[];
  managerComments: string[];
}

export interface Meeting {
  id: string;
  manager_id: string;
  meeting_number: number;
  date: string | null;
  type: MeetingType;
  status: MeetingStatus;
  previous_context_text: string | null;
  previous_context_json: PreviousContextJson | null;
  context_from_unclosed: boolean;
  scenario: string | null;
  transcription_prompt: string | null;
  transcription_text: string | null;
  transcription_file_url: string | null;
  key_facts: string | null;
  problems_signals: string | null;
  conclusions: string | null;
  strengths: string | null;
  weaknesses: string | null;
  action_plan: string | null;
  next_scenario: string | null;
  conducted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  target_type: CommentTarget;
  target_id: string;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  user_profile?: UserProfile; // joined
}

export interface AiSettings {
  id: string;
  user_id: string;
  preferred_model: string;
  created_at: string;
  updated_at: string;
}

// Агрегаты для UI
export interface CompanyWithMetrics extends Company {
  active_managers_count: number;
  last_meeting_date: string | null;
  total_meetings_count: number;
  closed_meetings_count: number;
}

export interface ManagerWithMetrics extends Manager {
  meetings_count: number;
  last_meeting_date: string | null;
}
```

---

## 6. Диаграмма связей

```
auth.users (Supabase Auth)
    │ 1
    │
    ├─── user_profiles (1:1)
    │       id, name, role
    │
    └─── ai_settings (1:1)
            id, user_id, preferred_model

companies
    │ 1
    │
    └─── managers (1:N)
              │ id, company_id, name, ...
              │ 1
              │
              └─── meetings (1:N)
                        id, manager_id, meeting_number, status, ...

comments (polymorphic)
    target_type = 'manager' → managers.id
    target_type = 'meeting' → meetings.id
    user_id → auth.users.id
```
