-- ============================================================
-- Meeting Intelligence App — Leader Profile Changelog
-- Migration: 013_leader_profile_changes.sql
-- Run AFTER 012_ai_settings_v2.sql
-- ============================================================

-- ============================================================
-- leader_profile_changes
-- Lightweight changelog of the "living" leader profile (left column).
-- One row = one short change summary.
-- changed_by='ai'     — derived automatically when a meeting is closed
-- changed_by='manual' — reserved for future manual edits logging
-- ============================================================
CREATE TABLE leader_profile_changes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- "leaderId" — the manager whose profile changed
  manager_id  UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  -- meeting that triggered the change (NULL for manual / non-meeting changes)
  meeting_id  UUID REFERENCES meetings(id) ON DELETE SET NULL,
  changed_by  TEXT NOT NULL DEFAULT 'ai'
                CHECK (changed_by IN ('ai', 'manual')),
  -- short, human-readable description of a single change
  summary     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leader_profile_changes_manager
  ON leader_profile_changes(manager_id, created_at DESC);
CREATE INDEX idx_leader_profile_changes_meeting
  ON leader_profile_changes(manager_id, meeting_id);

-- ============================================================
-- RLS — leader_profile_changes
-- Mirrors manager_problems: all authenticated users can read/write.
-- ============================================================
ALTER TABLE leader_profile_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_profile_changes" ON leader_profile_changes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_profile_changes" ON leader_profile_changes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_delete_profile_changes" ON leader_profile_changes
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
