-- Rename dealer_applications to dealer_verification
ALTER TABLE public.dealer_applications RENAME TO dealer_verification;

-- Rename RLS policies to match new table name
ALTER POLICY "Users can create applications" ON public.dealer_verification RENAME TO "Users can create verification";
ALTER POLICY "Users can view own applications" ON public.dealer_verification RENAME TO "Users can view own verification";
ALTER POLICY "Admins can update applications" ON public.dealer_verification RENAME TO "Admins can update verification";
ALTER POLICY "Admins can delete applications" ON public.dealer_verification RENAME TO "Admins can delete verification";