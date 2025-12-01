-- Make invoices bucket public to allow viewing files via public URL
UPDATE storage.buckets
SET public = true
WHERE id = 'invoices';

-- Ensure bucket exists if it was missing
INSERT INTO storage.buckets (id, name, public)
SELECT 'invoices', 'invoices', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'invoices'
);

-- Ensure policies exist for authenticated users
DO $$
BEGIN
    -- View policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Authenticated users can view invoices'
    ) THEN
        CREATE POLICY "Authenticated users can view invoices"
          ON storage.objects FOR SELECT
          TO authenticated
          USING (bucket_id = 'invoices');
    END IF;

    -- Upload policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Authenticated users can upload invoices'
    ) THEN
        CREATE POLICY "Authenticated users can upload invoices"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (bucket_id = 'invoices');
    END IF;
    
    -- Update policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Authenticated users can update invoices'
    ) THEN
        CREATE POLICY "Authenticated users can update invoices"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (bucket_id = 'invoices');
    END IF;
END $$;
