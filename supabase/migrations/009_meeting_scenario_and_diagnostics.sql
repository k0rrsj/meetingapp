-- Add per-user Telegram target, scenario approval metadata, and diagnostic extensions.

ALTER TABLE ai_settings
  ADD COLUMN telegram_chat_id TEXT;

ALTER TABLE meetings
  ADD COLUMN first_meeting_scenario_mode TEXT
    CHECK (first_meeting_scenario_mode IN ('manual', 'ai')),
  ADD COLUMN scenario_approved_at TIMESTAMPTZ,
  ADD COLUMN diagnostic_extension JSONB;

UPDATE meetings
SET first_meeting_scenario_mode = 'ai'
WHERE meeting_number = 1 AND first_meeting_scenario_mode IS NULL;
