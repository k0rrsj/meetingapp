-- ============================================================
-- Meeting Intelligence App — Manager Problems Tracker
-- Migration: 011_manager_problems.sql
-- Run AFTER 010_manager_dynamics_snapshot.sql
-- ============================================================

-- ============================================================
-- manager_problems
-- Accumulates problems and signals across all meetings.
-- source='ai'     — extracted automatically during transcription analysis
-- source='manual' — added manually by a user
-- ============================================================
CREATE TABLE manager_problems (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id              UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  text                    TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'resolved')),
  source                  TEXT NOT NULL DEFAULT 'ai'
                            CHECK (source IN ('ai', 'manual')),
  -- meeting where the problem was first detected (NULL for manual entries)
  first_seen_meeting_id   UUID REFERENCES meetings(id) ON DELETE SET NULL,
  -- meeting where the problem was resolved (NULL if resolved manually)
  resolved_meeting_id     UUID REFERENCES meetings(id) ON DELETE SET NULL,
  -- how many meetings this problem has been active (incremented on 'ongoing')
  meeting_count           INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_manager_problems_manager_id ON manager_problems(manager_id);
CREATE INDEX idx_manager_problems_status     ON manager_problems(manager_id, status);

CREATE TRIGGER update_manager_problems_updated_at
  BEFORE UPDATE ON manager_problems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS — manager_problems
-- All authenticated users can read and manage problems.
-- Both roles (consultant + assistant) can add and close problems.
-- ============================================================
ALTER TABLE manager_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_problems" ON manager_problems
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_problems" ON manager_problems
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_problems" ON manager_problems
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_problems" ON manager_problems
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
