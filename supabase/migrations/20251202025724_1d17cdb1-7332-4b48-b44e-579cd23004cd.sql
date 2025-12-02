-- Create petty-cash storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('petty-cash', 'petty-cash', true);

-- Allow authenticated users to view petty cash receipts
CREATE POLICY "Anyone authenticated can view petty cash receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'petty-cash' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to upload petty cash receipts
CREATE POLICY "Users can upload petty cash receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'petty-cash' AND auth.uid() IS NOT NULL);

-- Allow users to update their own petty cash receipts
CREATE POLICY "Users can update petty cash receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'petty-cash' AND auth.uid() IS NOT NULL);

-- Allow treasurers to delete petty cash receipts
CREATE POLICY "Treasurers can delete petty cash receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'petty-cash' AND auth.uid() IS NOT NULL);