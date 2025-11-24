-- Add GST amount column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN gst_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.expenses.gst_amount IS 'GST component of the expense amount (separate from base amount)';
