-- ============================================================
-- Meeting Intelligence App — Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- user_profiles
-- ============================================================
-- All authenticated users can read all profiles (for comment author display)
CREATE POLICY "authenticated_read_profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- companies
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

-- Both roles can update managers:
-- - assistant updates all fields except consultant_comments
-- - consultant updates only consultant_comments
-- Field-level restriction is enforced in the API Route layer
CREATE POLICY "authenticated_update_managers" ON managers
  FOR UPDATE TO authenticated
  USING (true);

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

-- Status changes are allowed for both roles (enforced at API layer)
CREATE POLICY "authenticated_update_meetings" ON meetings
  FOR UPDATE TO authenticated
  USING (true);

-- ============================================================
-- comments
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
-- ai_settings
-- ============================================================
CREATE POLICY "own_ai_settings_select" ON ai_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "own_ai_settings_insert" ON ai_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_ai_settings_update" ON ai_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
