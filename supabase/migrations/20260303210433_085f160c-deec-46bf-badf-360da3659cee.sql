
-- Allow users to delete their own scans
CREATE POLICY "Users can delete their own scans"
ON public.scans
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Allow users to delete their own similarity_matches (via scan ownership)
CREATE POLICY "Users can delete their scan matches"
ON public.similarity_matches
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM scans WHERE scans.id = similarity_matches.scan_id AND scans.user_id = auth.uid()
));

-- Allow users to delete their own citations
CREATE POLICY "Users can delete their scan citations"
ON public.citations
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM scans WHERE scans.id = citations.scan_id AND scans.user_id = auth.uid()
));

-- Allow users to delete their own bibliographies
CREATE POLICY "Users can delete their scan bibliographies"
ON public.bibliographies
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM scans WHERE scans.id = bibliographies.scan_id AND scans.user_id = auth.uid()
));

-- Allow users to delete their own scan reports
CREATE POLICY "Users can delete their scan reports"
ON public.scan_reports
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM scans WHERE scans.id = scan_reports.scan_id AND scans.user_id = auth.uid()
));
