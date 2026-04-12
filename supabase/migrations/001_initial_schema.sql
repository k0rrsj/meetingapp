-- ============================================================
-- Meeting Intelligence App — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Trigger function: auto-update updated_at on every UPDATE
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

-- Automatically create a profile when a new user registers
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
-- comments (polymorphic: target_type = 'manager' | 'meeting')
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
