-- Consultants may delete documents attached to a company (library), not manager-owned tracks.
CREATE POLICY "consultant_delete_company_documents" ON documents
  FOR DELETE TO authenticated
  USING (
    company_id IS NOT NULL
    AND (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'consultant'
  );
