-- Add GST amount column to income_actuals table
ALTER TABLE income_actuals 
ADD COLUMN gst_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN income_actuals.gst_amount IS 'GST component of the income entry. For CAM without GST, this will be 0. Dashboard aggregates actual_amount + gst_amount for total income.';