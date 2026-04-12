-- ============================================================
-- Meeting Intelligence App — Delete Policies
-- Migration: 004_delete_policies.sql
-- Adds missing DELETE RLS policies for managers, meetings, companies
-- ============================================================

-- managers: only assistant can delete
CREATE POLICY "assistant_delete_managers" ON managers
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

-- meetings: only assistant can delete
CREATE POLICY "assistant_delete_meetings" ON meetings
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );

-- companies: only assistant can delete
CREATE POLICY "assistant_delete_companies" ON companies
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'assistant'
  );
