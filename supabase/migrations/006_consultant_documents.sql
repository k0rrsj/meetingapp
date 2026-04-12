-- Migration 006: Consultant-level global documents
-- These documents apply to ALL managers across ALL companies

CREATE TABLE IF NOT EXISTS consultant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'methodology' CHECK (type IN ('methodology', 'rules', 'framework', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consultant_documents_user_id_idx ON consultant_documents(user_id);
CREATE INDEX IF NOT EXISTS consultant_documents_active_idx ON consultant_documents(user_id, is_active);

-- RLS
ALTER TABLE consultant_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultant_documents_select" ON consultant_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "consultant_documents_insert" ON consultant_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "consultant_documents_update" ON consultant_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "consultant_documents_delete" ON consultant_documents
  FOR DELETE USING (auth.uid() = user_id);
