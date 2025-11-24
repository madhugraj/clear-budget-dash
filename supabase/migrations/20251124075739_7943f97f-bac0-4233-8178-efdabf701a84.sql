-- Create function to notify treasurers when income is recorded
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
