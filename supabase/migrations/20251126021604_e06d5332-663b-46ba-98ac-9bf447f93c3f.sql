-- Add RLS policies for lead role
DROP POLICY IF EXISTS "Leads can view budget master" ON public.budget_master;
CREATE POLICY "Leads can view budget master"
ON public.budget_master
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'lead'::user_role));