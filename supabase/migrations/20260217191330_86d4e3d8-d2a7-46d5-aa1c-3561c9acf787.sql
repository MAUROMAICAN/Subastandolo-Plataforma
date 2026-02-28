
-- Add KYV columns to dealer_applications
ALTER TABLE public.dealer_applications
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS cedula_number text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS cedula_front_url text,
  ADD COLUMN IF NOT EXISTS cedula_back_url text,
  ADD COLUMN IF NOT EXISTS address_proof_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;

-- Private bucket for dealer documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('dealer-documents', 'dealer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: users upload their own documents
CREATE POLICY "Users upload own dealer docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dealer-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users view own docs, admins view all
CREATE POLICY "Users and admins view dealer docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dealer-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin')
  ));
