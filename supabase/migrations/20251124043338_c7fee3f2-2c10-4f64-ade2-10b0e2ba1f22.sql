-- Add parent category support to income_categories
ALTER TABLE public.income_categories 
ADD COLUMN parent_category_id uuid REFERENCES public.income_categories(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_income_categories_parent ON public.income_categories(parent_category_id);

-- Add a comment to clarify the structure
COMMENT ON COLUMN public.income_categories.parent_category_id IS 'References parent category for hierarchical structure. NULL for top-level parent categories.';
