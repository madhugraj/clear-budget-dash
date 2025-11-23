-- Add budget_master_id to expenses table to track expenses against detailed budget line items
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
CHECK (budget_item_id IS NOT NULL OR budget_master_id IS NOT NULL);