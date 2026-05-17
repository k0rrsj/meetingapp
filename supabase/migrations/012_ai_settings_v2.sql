-- ============================================================
-- Meeting Intelligence App — AI Settings v2
-- Migration: 012_ai_settings_v2.sql
-- Run AFTER 011_manager_problems.sql
-- ============================================================

-- ============================================================
-- ai_settings: split preferred_model into per-task models
-- and add Telegram meeting reminder toggle
-- ============================================================

-- Per-task model selection (defaults to existing preferred_model value)
ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS scenario_model  TEXT,
  ADD COLUMN IF NOT EXISTS analysis_model  TEXT,
  ADD COLUMN IF NOT EXISTS chat_model      TEXT;

-- Backfill: copy current preferred_model into all three new columns
UPDATE ai_settings
SET
  scenario_model = preferred_model,
  analysis_model = preferred_model,
  chat_model     = preferred_model
WHERE scenario_model IS NULL;

-- Telegram meeting reminder: send a notification the day before each meeting
ALTER TABLE ai_settings
  ADD COLUMN IF NOT EXISTS meeting_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE;
