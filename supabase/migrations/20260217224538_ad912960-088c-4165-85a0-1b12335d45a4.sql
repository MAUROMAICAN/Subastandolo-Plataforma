
-- Create dealer bank accounts table
CREATE TABLE public.dealer_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('corriente', 'ahorros')),
  account_number TEXT NOT NULL,
  identity_document TEXT NOT NULL,
  email TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.dealer_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Dealers can view and manage their own bank account
CREATE POLICY "Dealers can view own bank account"
ON public.dealer_bank_accounts FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Dealers can insert own bank account"
ON public.dealer_bank_accounts FOR INSERT
WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'dealer'::app_role));

CREATE POLICY "Dealers can update own bank account"
ON public.dealer_bank_accounts FOR UPDATE
USING (user_id = auth.uid() AND has_role(auth.uid(), 'dealer'::app_role));

-- Admins can manage all
CREATE POLICY "Admins can manage bank accounts"
ON public.dealer_bank_accounts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_dealer_bank_accounts_updated_at
  BEFORE UPDATE ON public.dealer_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
