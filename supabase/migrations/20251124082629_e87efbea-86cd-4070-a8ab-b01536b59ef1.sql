-- Add correction tracking fields to expenses table
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS is_correction boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS correction_reason text,
ADD COLUMN IF NOT EXISTS correction_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS correction_approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS correction_completed_at timestamp with time zone;

-- Add new status values for correction workflow
-- Note: status column already exists, we're just using new values:
-- 'correction_pending', 'correction_approved', 'correction_rejected'

-- Enhance audit_logs table with correction tracking
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS old_values jsonb,
ADD COLUMN IF NOT EXISTS new_values jsonb,
ADD COLUMN IF NOT EXISTS correction_type text,
ADD COLUMN IF NOT EXISTS is_correction_log boolean DEFAULT false;

-- Drop the existing trigger to recreate it with enhanced functionality
DROP TRIGGER IF EXISTS log_expense_changes ON public.expenses;

-- Enhanced trigger function for detailed correction tracking
CREATE OR REPLACE FUNCTION public.log_expense_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_action text;
  v_performed_by uuid;
  v_old_values jsonb;
  v_new_values jsonb;
  v_correction_type text;
  v_is_correction_log boolean;
BEGIN
  -- Determine action type and performer
  IF (TG_OP = 'INSERT') THEN
    v_action := 'submitted';
    v_performed_by := NEW.claimed_by;
    v_is_correction_log := false;
    
    INSERT INTO public.audit_logs (
      expense_id, 
      action, 
      performed_by, 
      details,
      is_correction_log
    )
    VALUES (
      NEW.id,
      v_action,
      v_performed_by,
      jsonb_build_object(
        'amount', NEW.amount,
        'gst_amount', NEW.gst_amount,
        'description', NEW.description,
        'expense_date', NEW.expense_date,
        'budget_item_id', NEW.budget_item_id
      ),
      v_is_correction_log
    );
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    v_performed_by := COALESCE(NEW.approved_by, auth.uid(), NEW.claimed_by);
    v_is_correction_log := NEW.is_correction OR OLD.status IN ('correction_pending', 'correction_approved');
    
    -- Status change tracking
    IF (OLD.status != NEW.status) THEN
      -- Standard approval/rejection
      IF (OLD.status = 'pending' AND NEW.status = 'approved') THEN
        v_action := 'approved';
      ELSIF (OLD.status = 'pending' AND NEW.status = 'rejected') THEN
        v_action := 'rejected';
      
      -- Correction workflow tracking
      ELSIF (OLD.status = 'approved' AND NEW.status = 'correction_pending') THEN
        v_action := 'correction_requested';
        v_performed_by := NEW.claimed_by;
      ELSIF (OLD.status = 'correction_pending' AND NEW.status = 'correction_approved') THEN
        v_action := 'correction_approved';
      ELSIF (OLD.status = 'correction_pending' AND NEW.status = 'approved') THEN
        v_action := 'correction_rejected';
      ELSIF (OLD.status = 'correction_approved' AND NEW.status = 'approved') THEN
        v_action := 'correction_completed';
        v_performed_by := NEW.claimed_by;
      ELSE
        v_action := 'status_changed';
      END IF;

      INSERT INTO public.audit_logs (
        expense_id,
        action,
        performed_by,
        details,
        is_correction_log
      )
      VALUES (
        NEW.id,
        v_action,
        v_performed_by,
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'correction_reason', NEW.correction_reason
        ),
        v_is_correction_log
      );
    END IF;

    -- Track field-level changes for corrections
    IF (v_is_correction_log AND OLD.status = 'correction_approved' AND NEW.status = 'approved') THEN
      -- Build before/after comparison
      v_old_values := jsonb_build_object(
        'amount', OLD.amount,
        'gst_amount', OLD.gst_amount,
        'expense_date', OLD.expense_date,
        'description', OLD.description,
        'budget_item_id', OLD.budget_item_id,
        'budget_master_id', OLD.budget_master_id
      );
      
      v_new_values := jsonb_build_object(
        'amount', NEW.amount,
        'gst_amount', NEW.gst_amount,
        'expense_date', NEW.expense_date,
        'description', NEW.description,
        'budget_item_id', NEW.budget_item_id,
        'budget_master_id', NEW.budget_master_id
      );

      -- Determine correction type
      IF (OLD.gst_amount = 0 AND NEW.gst_amount > 0) THEN
        v_correction_type := 'gst_split';
      ELSIF (OLD.amount != NEW.amount OR OLD.gst_amount != NEW.gst_amount) THEN
        v_correction_type := 'amount_change';
      ELSIF (OLD.expense_date != NEW.expense_date) THEN
        v_correction_type := 'date_change';
      ELSIF (OLD.budget_item_id != NEW.budget_item_id OR OLD.budget_master_id != NEW.budget_master_id) THEN
        v_correction_type := 'category_change';
      ELSIF (OLD.description != NEW.description) THEN
        v_correction_type := 'description_change';
      ELSE
        v_correction_type := 'other_change';
      END IF;

      INSERT INTO public.audit_logs (
        expense_id,
        action,
        performed_by,
        details,
        old_values,
        new_values,
        correction_type,
        is_correction_log
      )
      VALUES (
        NEW.id,
        'correction_changes_applied',
        v_performed_by,
        jsonb_build_object(
          'correction_reason', NEW.correction_reason,
          'fields_changed', jsonb_build_array(
            CASE WHEN OLD.amount != NEW.amount THEN 'amount' END,
            CASE WHEN OLD.gst_amount != NEW.gst_amount THEN 'gst_amount' END,
            CASE WHEN OLD.expense_date != NEW.expense_date THEN 'expense_date' END,
            CASE WHEN OLD.description != NEW.description THEN 'description' END,
            CASE WHEN OLD.budget_item_id != NEW.budget_item_id THEN 'budget_item' END
          )
        ),
        v_old_values,
        v_new_values,
        v_correction_type,
        true
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER log_expense_changes
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.log_expense_action();

-- Add RLS policies for correction workflow

-- Policy: Accountants can request corrections on their own approved expenses
CREATE POLICY "Accountants can request corrections"
ON public.expenses
FOR UPDATE
TO authenticated
USING (
  auth.uid() = claimed_by 
  AND status = 'approved'
)
WITH CHECK (
  auth.uid() = claimed_by 
  AND status = 'correction_pending'
  AND correction_reason IS NOT NULL
);

-- Policy: Accountants can edit expenses after treasurer approves correction
CREATE POLICY "Accountants can edit approved corrections"
ON public.expenses
FOR UPDATE
TO authenticated
USING (
  auth.uid() = claimed_by 
  AND status = 'correction_approved'
)
WITH CHECK (
  auth.uid() = claimed_by
);

-- Add comment for documentation
COMMENT ON COLUMN public.expenses.is_correction IS 'Marks this expense as a correction of historical data';
COMMENT ON COLUMN public.expenses.correction_reason IS 'Explanation for why this correction was needed or requested';
COMMENT ON COLUMN public.expenses.correction_requested_at IS 'Timestamp when accountant requested correction';
COMMENT ON COLUMN public.expenses.correction_approved_at IS 'Timestamp when treasurer approved the correction request';
COMMENT ON COLUMN public.expenses.correction_completed_at IS 'Timestamp when accountant completed the correction';
COMMENT ON COLUMN public.audit_logs.old_values IS 'JSONB snapshot of field values before correction';
COMMENT ON COLUMN public.audit_logs.new_values IS 'JSONB snapshot of field values after correction';
COMMENT ON COLUMN public.audit_logs.correction_type IS 'Type of correction: gst_split, amount_change, date_change, category_change, description_change';
COMMENT ON COLUMN public.audit_logs.is_correction_log IS 'Flags audit logs related to the correction workflow';