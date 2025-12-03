-- Add month column to cam_tracking
ALTER TABLE public.cam_tracking ADD COLUMN month INTEGER CHECK (month >= 1 AND month <= 12);

-- Drop the old unique constraint (tower, year, quarter)
ALTER TABLE public.cam_tracking DROP CONSTRAINT IF EXISTS cam_tracking_tower_year_quarter_key;

-- Add new unique constraint (tower, year, month)
-- Note: We keep quarter for easier aggregation, but uniqueness is now at month level
ALTER TABLE public.cam_tracking ADD CONSTRAINT cam_tracking_tower_year_month_key UNIQUE (tower, year, month);

-- Update existing records to have a default month if needed (optional, but good for data integrity)
-- For now, we assume new data will populate month correctly. 
-- If we wanted to migrate old data, we'd need a strategy to split quarterly data into months.
-- Since this is likely a fresh feature or we accept old data as "quarterly only" (month=NULL), we can leave it.
-- However, the unique constraint might fail if we have multiple entries for same tower/year with null month?
-- Actually, unique constraint allows multiple NULLs in Postgres. 
-- But if we want to enforce month, we should make it NOT NULL. 
-- Let's make it nullable for backward compatibility, but enforce it for new entries via application logic or trigger if needed.
