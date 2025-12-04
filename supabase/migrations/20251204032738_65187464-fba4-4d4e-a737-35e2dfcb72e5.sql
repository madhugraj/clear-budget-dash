-- Add workflow columns to cam_tracking for Save-Submit-Approve flow
ALTER TABLE public.cam_tracking 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'correction_pending', 'correction_approved')),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS correction_reason TEXT,
ADD COLUMN IF NOT EXISTS correction_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS correction_approved_at TIMESTAMP WITH TIME ZONE;

-- Update RLS policies to allow Lead to submit
DROP POLICY IF EXISTS "Lead and Treasurer can update CAM data" ON public.cam_tracking;

CREATE POLICY "Lead can update own CAM data" 
ON public.cam_tracking 
FOR UPDATE 
USING (
  (has_role(auth.uid(), 'lead'::user_role) AND uploaded_by = auth.uid() AND status IN ('draft', 'correction_approved'))
  OR has_role(auth.uid(), 'treasurer'::user_role)
);

-- Allow Lead to submit (change status from draft to submitted)
CREATE POLICY "Lead can submit CAM data" 
ON public.cam_tracking 
FOR UPDATE 
USING (has_role(auth.uid(), 'lead'::user_role) AND uploaded_by = auth.uid() AND status = 'draft')
WITH CHECK (status = 'submitted');