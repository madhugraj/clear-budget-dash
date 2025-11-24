-- Add status field to income_actuals table for approval workflow
ALTER TABLE public.income_actuals 
ADD COLUMN status text NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add approved_by field to track who approved
ALTER TABLE public.income_actuals 
ADD COLUMN approved_by uuid REFERENCES auth.users(id);

-- Add approved_at timestamp
ALTER TABLE public.income_actuals 
ADD COLUMN approved_at timestamp with time zone;