-- Add month and is_locked columns to cam_tracking
ALTER TABLE public.cam_tracking 
ADD COLUMN IF NOT EXISTS month INTEGER CHECK (month >= 1 AND month <= 12),
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- Drop old unique constraint if exists and add new one
ALTER TABLE public.cam_tracking DROP CONSTRAINT IF EXISTS cam_tracking_tower_year_quarter_key;
ALTER TABLE public.cam_tracking ADD CONSTRAINT cam_tracking_tower_year_month_key UNIQUE (tower, year, month);