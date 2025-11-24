-- Create trigger for logging expense actions
-- This must be AFTER INSERT/UPDATE/DELETE to avoid foreign key violations
DROP TRIGGER IF EXISTS log_expense_action_trigger ON public.expenses;

CREATE TRIGGER log_expense_action_trigger
  AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_expense_action();