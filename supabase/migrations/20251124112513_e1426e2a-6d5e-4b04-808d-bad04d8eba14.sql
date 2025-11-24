-- Drop foreign key constraint causing issues when inserting audit logs
ALTER TABLE public.audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_expense_id_fkey;