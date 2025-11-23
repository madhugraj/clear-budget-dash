-- Update RLS policies to allow public read access for dashboard

-- Drop existing restrictive policies for budget_master
DROP POLICY IF EXISTS "Anyone authenticated can view budget master" ON public.budget_master;

-- Create public read policy for budget_master
CREATE POLICY "Anyone can view budget master" 
ON public.budget_master 
FOR SELECT 
USING (true);

-- Drop existing restrictive policies for expenses
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;

-- Create public read policy for expenses
CREATE POLICY "Anyone can view expenses" 
ON public.expenses 
FOR SELECT 
USING (true);