-- Create petty_cash table
CREATE TABLE public.petty_cash (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.petty_cash
  ADD CONSTRAINT petty_cash_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id),
  ADD CONSTRAINT petty_cash_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);

-- Enable RLS
ALTER TABLE public.petty_cash ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone authenticated can view petty cash entries
CREATE POLICY "Authenticated users can view petty cash"
  ON public.petty_cash FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Leads, accountants, and treasurers can insert petty cash
CREATE POLICY "Users can insert petty cash"
  ON public.petty_cash FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

-- Users can update their own pending entries, treasurers can update any
CREATE POLICY "Users can update own pending petty cash"
  ON public.petty_cash FOR UPDATE
  USING ((auth.uid() = submitted_by AND status = 'pending') OR has_role(auth.uid(), 'treasurer'::user_role));

-- Treasurers can delete petty cash entries
CREATE POLICY "Treasurers can delete petty cash"
  ON public.petty_cash FOR DELETE
  USING (has_role(auth.uid(), 'treasurer'::user_role));

-- Create trigger for updated_at
CREATE TRIGGER update_petty_cash_updated_at
  BEFORE UPDATE ON public.petty_cash
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();