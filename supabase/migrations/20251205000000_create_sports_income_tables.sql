-- Add office_assistant to user_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'office_assistant') THEN
    ALTER TYPE public.user_role ADD VALUE 'office_assistant';
  END IF;
END $$;

-- Create sports_master table for one-time sport setup
CREATE TABLE IF NOT EXISTS public.sports_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_name TEXT NOT NULL,
  coach_trainer_academy TEXT NOT NULL,
  location TEXT NOT NULL,
  training_days TEXT[] NOT NULL,
  duration TEXT NOT NULL,
  num_students INTEGER NOT NULL DEFAULT 0,
  base_fare NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  agreement_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sports_income table for monthly income tracking
CREATE TABLE IF NOT EXISTS public.sports_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_id UUID NOT NULL REFERENCES public.sports_master(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  fiscal_year TEXT NOT NULL,
  amount_received NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sport_id, month, fiscal_year)
);

-- Enable RLS
ALTER TABLE public.sports_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_income ENABLE ROW LEVEL SECURITY;

-- RLS policies for sports_master
DROP POLICY IF EXISTS "Authenticated users can view sports master" ON public.sports_master;
CREATE POLICY "Authenticated users can view sports master"
ON public.sports_master FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Office assistant can insert sports master" ON public.sports_master;
CREATE POLICY "Office assistant can insert sports master"
ON public.sports_master FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'office_assistant') OR has_role(auth.uid(), 'treasurer'));

DROP POLICY IF EXISTS "Office assistant can update sports master" ON public.sports_master;
CREATE POLICY "Office assistant can update sports master"
ON public.sports_master FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'office_assistant') OR has_role(auth.uid(), 'treasurer'));

DROP POLICY IF EXISTS "Treasurer can delete sports master" ON public.sports_master;
CREATE POLICY "Treasurer can delete sports master"
ON public.sports_master FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'treasurer'));

-- RLS policies for sports_income
DROP POLICY IF EXISTS "Authenticated users can view sports income" ON public.sports_income;
CREATE POLICY "Authenticated users can view sports income"
ON public.sports_income FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Office assistant can insert sports income" ON public.sports_income;
CREATE POLICY "Office assistant can insert sports income"
ON public.sports_income FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'office_assistant') OR has_role(auth.uid(), 'treasurer'));

DROP POLICY IF EXISTS "Office assistant and treasurer can update sports income" ON public.sports_income;
CREATE POLICY "Office assistant and treasurer can update sports income"
ON public.sports_income FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'office_assistant') OR has_role(auth.uid(), 'treasurer') OR has_role(auth.uid(), 'accountant'));

DROP POLICY IF EXISTS "Treasurer can delete sports income" ON public.sports_income;
CREATE POLICY "Treasurer can delete sports income"
ON public.sports_income FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'treasurer'));

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_sports_master_updated_at ON public.sports_master;
CREATE TRIGGER update_sports_master_updated_at
BEFORE UPDATE ON public.sports_master
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_sports_income_updated_at ON public.sports_income;
CREATE TRIGGER update_sports_income_updated_at
BEFORE UPDATE ON public.sports_income
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert default sports
INSERT INTO public.sports_master (sport_name, coach_trainer_academy, location, training_days, duration, num_students, base_fare, gst_amount, total_amount, created_by, is_active)
SELECT 
  sport, 
  'To be configured', 
  'To be configured', 
  ARRAY['Monday', 'Wednesday', 'Friday'], 
  '1 hour', 
  0, 
  0, 
  0, 
  0,
  (SELECT id FROM auth.users LIMIT 1),
  false
FROM unnest(ARRAY[
  'Badminton',
  'Swimming',
  'Football',
  'Basketball',
  'Skating',
  'Tennis',
  'Yoga',
  'Bharatanatyam',
  'Dance',
  'Zumba',
  'Cricket',
  'Aero Fitness',
  'Chess',
  'Karate',
  'Silambattam'
]) AS sport
WHERE NOT EXISTS (SELECT 1 FROM public.sports_master WHERE sport_name = sport);
