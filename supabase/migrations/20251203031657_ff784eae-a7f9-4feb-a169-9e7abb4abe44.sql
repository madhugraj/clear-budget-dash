-- Create CAM tracking table for tower-wise paid/pending flats
CREATE TABLE public.cam_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tower TEXT NOT NULL,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  paid_flats INTEGER NOT NULL DEFAULT 0,
  pending_flats INTEGER NOT NULL DEFAULT 0,
  total_flats INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tower, year, quarter)
);

-- Enable RLS
ALTER TABLE public.cam_tracking ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view CAM data
CREATE POLICY "Authenticated users can view CAM data"
ON public.cam_tracking
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Lead and Treasurer can insert CAM data
CREATE POLICY "Lead and Treasurer can insert CAM data"
ON public.cam_tracking
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'lead'::user_role) OR 
  has_role(auth.uid(), 'treasurer'::user_role)
);

-- Lead and Treasurer can update CAM data
CREATE POLICY "Lead and Treasurer can update CAM data"
ON public.cam_tracking
FOR UPDATE
USING (
  has_role(auth.uid(), 'lead'::user_role) OR 
  has_role(auth.uid(), 'treasurer'::user_role)
);

-- Only Treasurer can delete CAM data
CREATE POLICY "Treasurer can delete CAM data"
ON public.cam_tracking
FOR DELETE
USING (has_role(auth.uid(), 'treasurer'::user_role));

-- Create trigger for updated_at
CREATE TRIGGER update_cam_tracking_updated_at
BEFORE UPDATE ON public.cam_tracking
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();