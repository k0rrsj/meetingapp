-- ============================================================
-- Meeting Intelligence App — Storage Policies
-- Migration: 003_storage_policies.sql
-- Run AFTER 001_initial_schema.sql and 002_rls_policies.sql
-- ============================================================

-- Create private bucket for transcription files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transcriptions',
  'transcriptions',
  false,
  10485760,  -- 10 MB in bytes
  ARRAY['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- All authenticated users can read transcription files
CREATE POLICY "authenticated_read_transcriptions"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'transcriptions');

-- Only assistants can upload transcription files
CREATE POLICY "assistant_upload_transcriptions"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'transcriptions' AND
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

-- Only assistants can replace (update) transcription files
CREATE POLICY "assistant_update_transcriptions"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'transcriptions' AND
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

-- Only assistants can delete transcription files
CREATE POLICY "assistant_delete_transcriptions"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'transcriptions' AND
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );
