-- Fix RLS policies for dashboard viewing - make them PERMISSIVE for all authenticated users

-- Fix Petty Cash viewing policy
DROP POLICY IF EXISTS "Authenticated users can view petty cash" ON public.petty_cash;
CREATE POLICY "Authenticated users can view petty cash" 
ON public.petty_cash 
FOR SELECT 
TO authenticated
USING (true);

-- Ensure CAM policy is correct
DROP POLICY IF EXISTS "Authenticated users can view CAM data" ON public.cam_tracking;
CREATE POLICY "Authenticated users can view CAM data" 
ON public.cam_tracking 
FOR SELECT 
TO authenticated
USING (true);