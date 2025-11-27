-- Fix income_actuals RLS policy for INSERT
DROP POLICY IF EXISTS "Accountants can insert income actuals" ON income_actuals;

CREATE POLICY "Accountants can insert income actuals" 
ON income_actuals 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (recorded_by = auth.uid())
);

-- Add policy to allow income approvals query
DROP POLICY IF EXISTS "Anyone can view income actuals" ON income_actuals;

CREATE POLICY "Users can view income actuals" 
ON income_actuals 
FOR SELECT 
USING (auth.uid() IS NOT NULL);