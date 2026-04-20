-- Persist analyzed cross-session dynamics per manager.
ALTER TABLE managers
  ADD COLUMN dynamics_snapshot JSONB,
  ADD COLUMN dynamics_snapshot_updated_at TIMESTAMPTZ;
