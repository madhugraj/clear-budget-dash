-- Fix RLS policy for CAM data viewing - make it PERMISSIVE instead of RESTRICTIVE
DROP POLICY IF EXISTS "Authenticated users can view CAM data" ON public.cam_tracking;

CREATE POLICY "Authenticated users can view CAM data" 
ON public.cam_tracking 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);