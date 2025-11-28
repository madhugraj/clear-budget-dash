-- Reset Database Script
-- Drops all tables, types, and functions created by the Budget Buddy Pro project.
-- Run this BEFORE running the consolidated migration if you need a clean slate.

-- 1. Drop Triggers (Cascades will handle most, but good to be clean)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop Tables (Order matters due to foreign keys)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.historical_spending CASCADE;
DROP TABLE IF EXISTS public.budget_items CASCADE;
DROP TABLE IF EXISTS public.budget_master CASCADE;
DROP TABLE IF EXISTS public.income_actuals CASCADE;
DROP TABLE IF EXISTS public.income_budget CASCADE;
DROP TABLE IF EXISTS public.income_categories CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Drop Functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.user_role) CASCADE;
DROP FUNCTION IF EXISTS public.log_expense_action() CASCADE;
DROP FUNCTION IF EXISTS public.notify_income_update() CASCADE;

-- 4. Drop Types
DROP TYPE IF EXISTS public.user_role CASCADE;

-- 5. Clean up Storage (Optional, but good for complete reset)
-- DELETE FROM storage.objects WHERE bucket_id = 'invoices';
-- DELETE FROM storage.buckets WHERE id = 'invoices';
