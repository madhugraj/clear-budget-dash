-- Create budget_master table for approved budget configuration
CREATE TABLE public.budget_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year TEXT NOT NULL DEFAULT 'FY25-26',
  serial_no INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  committee TEXT NOT NULL,
  annual_budget NUMERIC NOT NULL,
  monthly_budget NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(fiscal_year, serial_no)
);

-- Enable Row Level Security
ALTER TABLE public.budget_master ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view budget master
CREATE POLICY "Anyone authenticated can view budget master"
  ON public.budget_master
  FOR SELECT
  USING (true);

-- Only treasurers can insert budget master
CREATE POLICY "Only treasurers can insert budget master"
  ON public.budget_master
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'treasurer'::user_role));

-- Only treasurers can update budget master
CREATE POLICY "Only treasurers can update budget master"
  ON public.budget_master
  FOR UPDATE
  USING (has_role(auth.uid(), 'treasurer'::user_role));

-- Add trigger for updated_at
CREATE TRIGGER update_budget_master_updated_at
  BEFORE UPDATE ON public.budget_master
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add index for faster queries
CREATE INDEX idx_budget_master_fiscal_year ON public.budget_master(fiscal_year);
CREATE INDEX idx_budget_master_category ON public.budget_master(category);