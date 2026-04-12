-- ============================================================
-- Meeting Intelligence App — New Features Schema
-- Migration: 005_new_features.sql
-- Run AFTER 004_delete_policies.sql
-- ============================================================

-- ============================================================
-- Add ai_rules field to managers
-- ============================================================
ALTER TABLE managers ADD COLUMN IF NOT EXISTS ai_rules TEXT;

-- ============================================================
-- documents
-- Library of files attached to a company or manager.
-- Exactly one of company_id / manager_id must be set.
-- ============================================================
CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID REFERENCES companies(id) ON DELETE CASCADE,
  manager_id   UUID REFERENCES managers(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT 'other'
                 CHECK (type IN ('track', 'roadmap', 'chronology', 'other')),
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT documents_owner_check CHECK (
    (company_id IS NOT NULL)::int + (manager_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX idx_documents_company_id ON documents(company_id);
CREATE INDEX idx_documents_manager_id ON documents(manager_id);
CREATE INDEX idx_documents_type ON documents(type);

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- document_versions
-- Immutable history of document content snapshots.
-- ============================================================
CREATE TABLE document_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_versions_document_id ON document_versions(document_id);

-- ============================================================
-- manager_chat_messages
-- Per-manager AI chat history (last N loaded per request).
-- ============================================================
CREATE TABLE manager_chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_manager_id ON manager_chat_messages(manager_id, created_at DESC);

-- ============================================================
-- interim_events
-- Events recorded between meetings (via app or Telegram bot).
-- ============================================================
CREATE TABLE interim_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'telegram')),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interim_events_manager_id ON interim_events(manager_id, created_at DESC);

-- ============================================================
-- goals
-- Goal tree per manager: hierarchical with progress tracking.
-- ============================================================
CREATE TABLE goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id   UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES goals(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned', 'in_progress', 'completed')),
  progress     INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_manager_id ON goals(manager_id);
CREATE INDEX idx_goals_parent_id ON goals(parent_id);

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS — documents
-- ============================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_documents" ON documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_documents" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_documents" ON documents
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "assistant_delete_documents" ON documents
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

-- ============================================================
-- RLS — document_versions
-- ============================================================
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_doc_versions" ON document_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_doc_versions" ON document_versions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- RLS — manager_chat_messages
-- ============================================================
ALTER TABLE manager_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_chat" ON manager_chat_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_chat" ON manager_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- RLS — interim_events
-- ============================================================
ALTER TABLE interim_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_events" ON interim_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_events" ON interim_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_events" ON interim_events
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- RLS — goals
-- ============================================================
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_goals" ON goals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_goals" ON goals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_goals" ON goals
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "assistant_delete_goals" ON goals
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );
