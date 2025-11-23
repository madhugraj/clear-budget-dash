-- Create audit_logs table to track all expense-related actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'submitted', 'approved', 'rejected', 'updated'
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  details JSONB, -- Additional context like old/new values, reason, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view audit logs
CREATE POLICY "Authenticated users can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);

-- Policy: System can insert audit logs (via triggers/functions)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = performed_by);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_expense_id ON public.audit_logs(expense_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Function to log expense actions
CREATE OR REPLACE FUNCTION public.log_expense_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log on INSERT (submission)
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (expense_id, action, performed_by, details)
    VALUES (
      NEW.id,
      'submitted',
      NEW.claimed_by,
      jsonb_build_object(
        'amount', NEW.amount,
        'description', NEW.description,
        'expense_date', NEW.expense_date
      )
    );
    RETURN NEW;
  END IF;

  -- Log on UPDATE (approval/rejection)
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.status != NEW.status) THEN
      INSERT INTO public.audit_logs (expense_id, action, performed_by, details)
      VALUES (
        NEW.id,
        CASE 
          WHEN NEW.status = 'approved' THEN 'approved'
          WHEN NEW.status = 'rejected' THEN 'rejected'
          ELSE 'updated'
        END,
        COALESCE(NEW.approved_by, auth.uid()),
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'amount', NEW.amount
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for expense audit logging
CREATE TRIGGER expense_audit_trigger
AFTER INSERT OR UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.log_expense_action();