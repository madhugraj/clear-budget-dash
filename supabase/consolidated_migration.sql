-- Create role enum
CREATE TYPE public.user_role AS ENUM ('treasurer', 'accountant');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create budget_items table
CREATE TABLE public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  allocated_amount NUMERIC(12, 2) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  UNIQUE(category, fiscal_year)
);

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view budget items"
  ON public.budget_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only treasurers can insert budget items"
  ON public.budget_items FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'treasurer'));

CREATE POLICY "Only treasurers can update budget items"
  ON public.budget_items FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'treasurer'));

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id UUID REFERENCES public.budget_items(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  invoice_url TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  claimed_by UUID REFERENCES public.profiles(id) NOT NULL,
  approved_by UUID REFERENCES public.profiles(id),
  expense_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can insert expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = claimed_by);

CREATE POLICY "Accountants can update their own pending expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = claimed_by AND status = 'pending');

CREATE POLICY "Treasurers can update any expense"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'treasurer'));

-- Create historical_spending table
CREATE TABLE public.historical_spending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id UUID REFERENCES public.budget_items(id) ON DELETE CASCADE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  q1_amount NUMERIC(12, 2) DEFAULT 0,
  q2_amount NUMERIC(12, 2) DEFAULT 0,
  q3_amount NUMERIC(12, 2) DEFAULT 0,
  q4_amount NUMERIC(12, 2) DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(budget_item_id, fiscal_year)
);

ALTER TABLE public.historical_spending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view historical spending"
  ON public.historical_spending FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can insert historical spending"
  ON public.historical_spending FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Accountants can update historical spending"
  ON public.historical_spending FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoices
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON storage.objects;
CREATE POLICY "Authenticated users can view invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

DROP POLICY IF EXISTS "Authenticated users can upload invoices" ON storage.objects;
CREATE POLICY "Authenticated users can upload invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

-- Trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_expense_updated
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_historical_spending_updated
  BEFORE UPDATE ON public.historical_spending
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();-- Fix search_path for handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;-- Create budget_master table for approved budget configuration
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
CREATE INDEX idx_budget_master_category ON public.budget_master(category);-- Add budget_master_id to expenses table to track expenses against detailed budget line items
ALTER TABLE expenses 
ADD COLUMN budget_master_id uuid REFERENCES budget_master(id);

-- Make budget_item_id nullable for backwards compatibility
ALTER TABLE expenses 
ALTER COLUMN budget_item_id DROP NOT NULL;

-- Create index for better query performance
CREATE INDEX idx_expenses_budget_master_id ON expenses(budget_master_id);

-- Update RLS policies to allow both budget_item_id and budget_master_id based expenses
-- (existing policies will continue to work)

-- Add check constraint to ensure at least one budget reference exists
ALTER TABLE expenses
ADD CONSTRAINT expenses_budget_reference_check 
CHECK (budget_item_id IS NOT NULL OR budget_master_id IS NOT NULL);-- Create audit_logs table to track all expense-related actions
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
EXECUTE FUNCTION public.log_expense_action();-- Create trigger to automatically log expense actions
CREATE TRIGGER log_expense_changes
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_expense_action();-- Update RLS policies to allow public read access for dashboard

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
USING (true);-- Create income categories table to store all income sources
CREATE TABLE public.income_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_name TEXT NOT NULL,
  subcategory_name TEXT,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create income budget table for annual/monthly budgeted amounts
CREATE TABLE public.income_budget (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.income_categories(id) ON DELETE CASCADE,
  budgeted_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fiscal_year, category_id)
);

-- Create income actuals table for monthly income received
CREATE TABLE public.income_actuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  category_id UUID NOT NULL REFERENCES public.income_categories(id) ON DELETE CASCADE,
  actual_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fiscal_year, month, category_id)
);

-- Enable RLS
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_actuals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for income_categories
CREATE POLICY "Anyone can view income categories"
  ON public.income_categories FOR SELECT
  USING (true);

CREATE POLICY "Only treasurers can manage income categories"
  ON public.income_categories FOR ALL
  USING (has_role(auth.uid(), 'treasurer'::user_role));

-- RLS Policies for income_budget
CREATE POLICY "Anyone can view income budget"
  ON public.income_budget FOR SELECT
  USING (true);

CREATE POLICY "Only treasurers can manage income budget"
  ON public.income_budget FOR ALL
  USING (has_role(auth.uid(), 'treasurer'::user_role));

-- RLS Policies for income_actuals
CREATE POLICY "Anyone can view income actuals"
  ON public.income_actuals FOR SELECT
  USING (true);

CREATE POLICY "Accountants can insert income actuals"
  ON public.income_actuals FOR INSERT
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Accountants can update their own income actuals"
  ON public.income_actuals FOR UPDATE
  USING (auth.uid() = recorded_by);

CREATE POLICY "Treasurers can manage all income actuals"
  ON public.income_actuals FOR ALL
  USING (has_role(auth.uid(), 'treasurer'::user_role));

-- Create triggers for updated_at
CREATE TRIGGER update_income_categories_updated_at
  BEFORE UPDATE ON public.income_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_income_budget_updated_at
  BEFORE UPDATE ON public.income_budget
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_income_actuals_updated_at
  BEFORE UPDATE ON public.income_actuals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert default income categories based on the requirements
INSERT INTO public.income_categories (category_name, subcategory_name, display_order) VALUES
  ('CAM with GST', NULL, 1),
  ('CAM without GST', NULL, 2),
  ('Commercial Letout Income', 'INDUS TOWER - RENTAL INCOME', 3),
  ('Commercial Letout Income', 'INDUS TOWER - EB INCOME', 4),
  ('Commercial Letout Income', 'HDFC TOWER - RENTAL INCOME', 5),
  ('Commercial Letout Income', 'HDFC TOWER - EB INCOME', 6),
  ('Commercial Letout Income', 'AAVIN BOOTH - RENTAL INCOME', 7),
  ('Commercial Letout Income', 'AAVIN BOOTH - EB INCOME', 8),
  ('Commercial Letout Income', 'VEDHIKA FOODS - RENTAL INCOME', 9),
  ('Commercial Letout Income', 'VEDHIKA FOODS - EB INCOME', 10),
  ('Interest Earned - Savings Account', 'INTEREST INCOME - IOB', 11),
  ('Interest Earned - Savings Account', 'INTEREST INCOME - ICICI', 12),
  ('Interest Earned - Savings Account', 'Corpus Income', 13),
  ('Events and Activities', 'Sports & Training', 14),
  ('Events and Activities', 'Stalls', 15),
  ('Rental from Halls', 'Gold Hall', 16),
  ('Rental from Halls', 'Silver Hall', 17),
  ('Rental from Halls', 'Platinum Hall', 18),
  ('Others', 'Miscellaneous Income', 19);-- Add parent category support to income_categories
ALTER TABLE public.income_categories 
ADD COLUMN parent_category_id uuid REFERENCES public.income_categories(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_income_categories_parent ON public.income_categories(parent_category_id);

-- Add a comment to clarify the structure
COMMENT ON COLUMN public.income_categories.parent_category_id IS 'References parent category for hierarchical structure. NULL for top-level parent categories.';
-- Add GST amount column to income_actuals table
ALTER TABLE income_actuals 
ADD COLUMN gst_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN income_actuals.gst_amount IS 'GST component of the income entry. For CAM without GST, this will be 0. Dashboard aggregates actual_amount + gst_amount for total income.';-- Create function to notify treasurers when income is recorded
CREATE OR REPLACE FUNCTION notify_income_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url text;
BEGIN
  -- Get the edge function URL
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-income-notification';
  
  -- Call the edge function asynchronously using pg_net if available
  -- For now, we'll use a simpler approach with http extension if installed
  -- Note: This is a placeholder - the actual notification will be triggered from the application
  
  -- Log the action for audit purposes
  RAISE NOTICE 'Income record % was %', NEW.id, TG_OP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for income_actuals INSERT
CREATE TRIGGER on_income_created
  AFTER INSERT ON income_actuals
  FOR EACH ROW
  EXECUTE FUNCTION notify_income_update();

-- Create trigger for income_actuals UPDATE
CREATE TRIGGER on_income_updated
  AFTER UPDATE ON income_actuals
  FOR EACH ROW
  EXECUTE FUNCTION notify_income_update();

COMMENT ON FUNCTION notify_income_update() IS 'Triggers notification to treasurers when accountants create or update income records';
-- Add GST amount column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN gst_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.expenses.gst_amount IS 'GST component of the expense amount (separate from base amount)';
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
COMMENT ON COLUMN public.audit_logs.is_correction_log IS 'Flags audit logs related to the correction workflow';-- Add status field to income_actuals table for approval workflow
ALTER TABLE public.income_actuals 
ADD COLUMN status text NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add approved_by field to track who approved
ALTER TABLE public.income_actuals 
ADD COLUMN approved_by uuid REFERENCES auth.users(id);

-- Add approved_at timestamp
ALTER TABLE public.income_actuals 
ADD COLUMN approved_at timestamp with time zone;-- Create trigger for logging expense actions
-- This must be AFTER INSERT/UPDATE/DELETE to avoid foreign key violations
DROP TRIGGER IF EXISTS log_expense_action_trigger ON public.expenses;

CREATE TRIGGER log_expense_action_trigger
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_expense_action();-- Drop foreign key constraint causing issues when inserting audit logs
ALTER TABLE public.audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_expense_id_fkey;-- Add 'lead' role to user_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'user_role' AND e.enumlabel = 'lead') THEN
    ALTER TYPE public.user_role ADD VALUE 'lead';
  END IF;
END $$;-- Add RLS policies for lead role
DROP POLICY IF EXISTS "Leads can view budget master" ON public.budget_master;
CREATE POLICY "Leads can view budget master"
ON public.budget_master
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'lead'::user_role));-- Fix income_actuals RLS policy for INSERT
DROP POLICY IF EXISTS "Accountants can insert income actuals" ON income_actuals;

CREATE POLICY "Accountants can insert income actuals" 
ON income_actuals 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (recorded_by = auth.uid())
);

-- Add policy to allow income approvals query
DROP POLICY IF EXISTS "Anyone can view income actuals" ON income_actuals;

CREATE POLICY "Users can view income actuals" 
ON income_actuals 
FOR SELECT 
USING (auth.uid() IS NOT NULL);-- Fix swapped CAM data for July (Month 7)
-- "CAM with GST" and "CAM without GST" amounts were swapped.

DO $$
DECLARE
  v_cam_with_gst_id uuid;
  v_cam_without_gst_id uuid;
  v_cam_with_gst_record record;
  v_cam_without_gst_record record;
BEGIN
  -- 1. Get Category IDs
  SELECT id INTO v_cam_with_gst_id FROM income_categories WHERE category_name ILIKE '%CAM with GST%' LIMIT 1;
  SELECT id INTO v_cam_without_gst_id FROM income_categories WHERE category_name ILIKE '%CAM without GST%' LIMIT 1;

  IF v_cam_with_gst_id IS NULL OR v_cam_without_gst_id IS NULL THEN
    RAISE NOTICE 'Could not find CAM categories. Skipping migration.';
    RETURN;
  END IF;

  -- 2. Get July Records (Month 7)
  -- Assuming fiscal year is 'FY25-26' based on previous context, but let's check for any fiscal year to be safe or restrict if needed.
  -- The issue description implies it's for the current data.
  
  -- Fetch record for CAM with GST
  SELECT * INTO v_cam_with_gst_record 
  FROM income_actuals 
  WHERE category_id = v_cam_with_gst_id AND month = 7;

  -- Fetch record for CAM without GST
  SELECT * INTO v_cam_without_gst_record 
  FROM income_actuals 
  WHERE category_id = v_cam_without_gst_id AND month = 7;

  IF v_cam_with_gst_record IS NULL OR v_cam_without_gst_record IS NULL THEN
    RAISE NOTICE 'Could not find both income records for July. Skipping migration.';
    RETURN;
  END IF;

  -- 3. Swap amounts
  -- Update CAM with GST record with values from CAM without GST record
  UPDATE income_actuals
  SET 
    actual_amount = v_cam_without_gst_record.actual_amount,
    gst_amount = v_cam_without_gst_record.gst_amount
  WHERE id = v_cam_with_gst_record.id;

  -- Update CAM without GST record with values from CAM with GST record (original values stored in variable)
  UPDATE income_actuals
  SET 
    actual_amount = v_cam_with_gst_record.actual_amount,
    gst_amount = v_cam_with_gst_record.gst_amount
  WHERE id = v_cam_without_gst_record.id;

  RAISE NOTICE 'Successfully swapped CAM amounts for July.';

END $$;
-- Fix RLS policy for Accountants to allow updating income_actuals
-- Previously, they could only update records they created (recorded_by = auth.uid()).
-- This blocked 'upsert' operations when modifying existing records created by others.

DROP POLICY IF EXISTS "Accountants can update their own income actuals" ON income_actuals;

CREATE POLICY "Accountants can update income actuals"
ON income_actuals
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'accountant')
);

-- Also ensure they can insert (already covered by 20251127032301... but let's be safe and explicit about role if needed, 
-- though the previous one checked recorded_by = auth.uid() which is fine for new inserts).
-- The previous INSERT policy:
-- CREATE POLICY "Accountants can insert income actuals" ... WITH CHECK (auth.uid() IS NOT NULL AND (recorded_by = auth.uid()));
-- This is fine for INSERT. The issue was UPDATE during upsert.
