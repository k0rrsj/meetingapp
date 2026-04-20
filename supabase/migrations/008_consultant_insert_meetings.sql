-- Allow consultants to create meetings (same insert path as assistants).
CREATE POLICY "consultant_insert_meetings" ON meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'consultant'
  );
