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
VALUES ('invoices', 'invoices', false);

-- Storage policies for invoices
CREATE POLICY "Authenticated users can view invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

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
  EXECUTE FUNCTION public.handle_updated_at();