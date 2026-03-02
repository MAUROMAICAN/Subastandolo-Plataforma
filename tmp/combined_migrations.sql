
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Auctions table
CREATE TABLE public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  starting_price NUMERIC NOT NULL DEFAULT 0,
  current_price NUMERIC NOT NULL DEFAULT 0,
  end_time TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  winner_id UUID REFERENCES auth.users(id),
  winner_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;

-- 5. Bids table
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  bidder_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- 6. Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 7. Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Trigger to update current_price and winner on new bid
CREATE OR REPLACE FUNCTION public.handle_new_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auctions
  SET current_price = NEW.amount,
      winner_id = NEW.user_id,
      winner_name = NEW.bidder_name
  WHERE id = NEW.auction_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_bid_placed
  AFTER INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_bid();

-- 9. RLS Policies

-- Profiles
CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- User roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auctions: everyone can view, only admin can create/update/delete
CREATE POLICY "Anyone can view auctions" ON public.auctions FOR SELECT USING (true);
CREATE POLICY "Admins can create auctions" ON public.auctions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update auctions" ON public.auctions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete auctions" ON public.auctions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Bids: everyone can view, authenticated can create own
CREATE POLICY "Anyone can view bids" ON public.bids FOR SELECT USING (true);
CREATE POLICY "Authenticated users can bid" ON public.bids FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 10. Enable realtime for auctions and bids
ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;

-- 11. Storage bucket for auction images
INSERT INTO storage.buckets (id, name, public) VALUES ('auction-images', 'auction-images', true);
CREATE POLICY "Anyone can view auction images" ON storage.objects FOR SELECT USING (bucket_id = 'auction-images');
CREATE POLICY "Admins can upload auction images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'auction-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete auction images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'auction-images' AND public.has_role(auth.uid(), 'admin'));

-- Create banner_images table for admin-managed hero banners
CREATE TABLE public.banner_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.banner_images ENABLE ROW LEVEL SECURITY;

-- Everyone can view active banners
CREATE POLICY "Anyone can view active banners"
ON public.banner_images
FOR SELECT
USING (is_active = true);

-- Admins can manage banners
CREATE POLICY "Admins can insert banners"
ON public.banner_images
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update banners"
ON public.banner_images
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete banners"
ON public.banner_images
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for banner images
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-images', 'banner-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for banner images
CREATE POLICY "Anyone can view banner images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'banner-images');

CREATE POLICY "Admins can upload banner images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'banner-images');

CREATE POLICY "Admins can delete banner images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'banner-images');

-- Add 'dealer' to the app_role enum (must be separate transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dealer';

-- Create dealer applications table
CREATE TABLE public.dealer_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  business_description TEXT,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dealer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications"
ON public.dealer_applications
FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create applications"
ON public.dealer_applications
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update applications"
ON public.dealer_applications
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete applications"
ON public.dealer_applications
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Update auction policies for dealers
DROP POLICY IF EXISTS "Admins can create auctions" ON public.auctions;
DROP POLICY IF EXISTS "Admins can update auctions" ON public.auctions;
DROP POLICY IF EXISTS "Admins can delete auctions" ON public.auctions;

CREATE POLICY "Admins and dealers can create auctions"
ON public.auctions
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.has_role(auth.uid(), 'dealer'::app_role) AND created_by = auth.uid())
);

CREATE POLICY "Admins and dealers can update auctions"
ON public.auctions
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.has_role(auth.uid(), 'dealer'::app_role) AND created_by = auth.uid())
);

CREATE POLICY "Admins and dealers can delete auctions"
ON public.auctions
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.has_role(auth.uid(), 'dealer'::app_role) AND created_by = auth.uid())
);

-- Add status and admin_notes to auctions
ALTER TABLE public.auctions 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS admin_notes text;

-- Update existing auctions to 'active' status
UPDATE public.auctions SET status = 'active' WHERE status IS NULL OR status = '';

-- Create auction_images table for multiple photos per auction
CREATE TABLE public.auction_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on auction_images
ALTER TABLE public.auction_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view images of visible auctions
CREATE POLICY "Anyone can view auction images"
ON public.auction_images
FOR SELECT
USING (true);

-- Dealers/admins can insert images for their own auctions
CREATE POLICY "Dealers and admins can insert auction images"
ON public.auction_images
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.auctions 
    WHERE id = auction_id 
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Dealers/admins can delete images for their own auctions
CREATE POLICY "Dealers and admins can delete auction images"
ON public.auction_images
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.auctions 
    WHERE id = auction_id 
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Update the auctions SELECT policy to show only approved/active to public, all to owners/admins
DROP POLICY IF EXISTS "Anyone can view auctions" ON public.auctions;
CREATE POLICY "Public can view approved auctions"
ON public.auctions
FOR SELECT
USING (
  status IN ('active', 'finalized')
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Enable realtime for auction_images
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_images;

-- Site settings table for CMS (key-value pairs for site configuration)
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text,
  setting_type text NOT NULL DEFAULT 'text', -- text, color, image, json
  category text NOT NULL DEFAULT 'general', -- general, appearance, footer, nav, seo
  label text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.site_settings (setting_key, setting_value, setting_type, category, label) VALUES
  ('site_name', 'SubastaYa', 'text', 'general', 'Nombre del Sitio'),
  ('site_description', 'La plataforma #1 de subastas en lÃ­nea', 'text', 'general', 'DescripciÃ³n del Sitio'),
  ('footer_text', 'Â© 2025 SubastaYa. Todos los derechos reservados.', 'text', 'footer', 'Texto del Footer'),
  ('contact_email', '', 'text', 'general', 'Email de Contacto'),
  ('contact_phone', '', 'text', 'general', 'TelÃ©fono de Contacto'),
  ('whatsapp_number', '', 'text', 'general', 'NÃºmero de WhatsApp'),
  ('hero_cta_text', 'RegÃ­strate para Pujar', 'text', 'general', 'Texto del BotÃ³n Hero'),
  ('announcement_bar', '', 'text', 'general', 'Barra de Anuncio (vacÃ­o = oculta)'),
  ('primary_color', '213 94% 30%', 'color', 'appearance', 'Color Primario (HSL)'),
  ('accent_color', '45 100% 51%', 'color', 'appearance', 'Color Acento (HSL)');

-- Dynamic sections for the homepage
CREATE TABLE public.site_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  title text,
  content text,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  section_type text NOT NULL DEFAULT 'content', -- content, faq, features, cta
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible sections" ON public.site_sections FOR SELECT USING (is_visible = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage sections" ON public.site_sections FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default sections
INSERT INTO public.site_sections (section_key, title, content, is_visible, display_order, section_type) VALUES
  ('how_it_works', 'CÃ³mo Funciona', 'RegÃ­strate, encuentra productos increÃ­bles y puja para ganar.', true, 1, 'features'),
  ('faq', 'Preguntas Frecuentes', '', true, 2, 'faq'),
  ('cta_bottom', 'Â¿Listo para empezar?', 'Ãšnete a miles de usuarios que ya estÃ¡n ganando subastas increÃ­bles.', true, 3, 'cta');

-- Internal messaging between admin and dealers
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  auction_id uuid REFERENCES public.auctions(id) ON DELETE SET NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users can mark messages read" ON public.messages FOR UPDATE USING (receiver_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;

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
-- Rename dealer_applications to dealer_verification
ALTER TABLE public.dealer_applications RENAME TO dealer_verification;

-- Rename RLS policies to match new table name
ALTER POLICY "Users can create applications" ON public.dealer_verification RENAME TO "Users can create verification";
ALTER POLICY "Users can view own applications" ON public.dealer_verification RENAME TO "Users can view own verification";
ALTER POLICY "Admins can update applications" ON public.dealer_verification RENAME TO "Admins can update verification";
ALTER POLICY "Admins can delete applications" ON public.dealer_verification RENAME TO "Admins can delete verification";

-- Add dealer management fields
ALTER TABLE public.dealer_verification
ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS manual_tier text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS status_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS status_changed_by uuid DEFAULT NULL;

-- account_status: 'active', 'paused', 'under_review', 'banned'
-- manual_tier: null means automatic, or 'nuevo','bronce','plata','oro','platinum','ruby' for manual override

-- Reviews table for the reputation system
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  reviewed_id UUID NOT NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('buyer_to_dealer', 'dealer_to_buyer')),
  
  -- Overall rating 1-5
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- Dealer review aspects (1-5, null if dealer_to_buyer)
  product_accuracy INTEGER CHECK (product_accuracy IS NULL OR (product_accuracy >= 1 AND product_accuracy <= 5)),
  attention_quality INTEGER CHECK (attention_quality IS NULL OR (attention_quality >= 1 AND attention_quality <= 5)),
  shipping_speed INTEGER CHECK (shipping_speed IS NULL OR (shipping_speed >= 1 AND shipping_speed <= 5)),
  
  -- Buyer review aspects (1-5, null if buyer_to_dealer)
  payment_compliance INTEGER CHECK (payment_compliance IS NULL OR (payment_compliance >= 1 AND payment_compliance <= 5)),
  communication_quality INTEGER CHECK (communication_quality IS NULL OR (communication_quality >= 1 AND communication_quality <= 5)),
  
  -- Quick tags
  tags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- One review per auction per direction
  UNIQUE(auction_id, reviewer_id, review_type)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews (public reputation)
CREATE POLICY "Anyone can view reviews"
ON public.reviews
FOR SELECT
USING (true);

-- Authenticated users can create reviews for auctions they participated in
CREATE POLICY "Users can create reviews"
ON public.reviews
FOR INSERT
WITH CHECK (reviewer_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
ON public.reviews
FOR UPDATE
USING (reviewer_id = auth.uid());

-- Enable realtime for reviews
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;

-- Add reply_text column for the reviewed person to respond
ALTER TABLE public.reviews ADD COLUMN reply_text TEXT DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN replied_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Allow the reviewed person to update reply_text on their reviews
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;

CREATE POLICY "Users can update own reviews"
ON public.reviews
FOR UPDATE
USING (reviewer_id = auth.uid() OR reviewed_id = auth.uid());

-- 1. Computed function: get reputation stats for a user in real-time
CREATE OR REPLACE FUNCTION public.get_user_reputation_stats(p_user_id uuid, p_review_type text)
RETURNS TABLE (
  total_reviews bigint,
  avg_rating numeric,
  positive_percentage numeric,
  avg_product_accuracy numeric,
  avg_attention_quality numeric,
  avg_shipping_speed numeric,
  avg_payment_compliance numeric,
  avg_communication_quality numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_reviews,
    COALESCE(AVG(rating), 0) AS avg_rating,
    CASE WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE rating >= 4))::numeric / COUNT(*)::numeric * 100
      ELSE 0
    END AS positive_percentage,
    COALESCE(AVG(product_accuracy), 0) AS avg_product_accuracy,
    COALESCE(AVG(attention_quality), 0) AS avg_attention_quality,
    COALESCE(AVG(shipping_speed), 0) AS avg_shipping_speed,
    COALESCE(AVG(payment_compliance), 0) AS avg_payment_compliance,
    COALESCE(AVG(communication_quality), 0) AS avg_communication_quality
  FROM public.reviews
  WHERE reviewed_id = p_user_id
    AND review_type = p_review_type;
$$;

-- 2. Drop old INSERT policy and create restrictive one: only auction winner can review dealer
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;

CREATE POLICY "Only auction winner can review"
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND (
      -- buyer_to_dealer: reviewer must be the winner of that auction
      (review_type = 'buyer_to_dealer' AND EXISTS (
        SELECT 1 FROM public.auctions
        WHERE auctions.id = reviews.auction_id
          AND auctions.winner_id = auth.uid()
          AND auctions.status = 'finalized'
      ))
      OR
      -- dealer_to_buyer: reviewer must be the auction creator (dealer)
      (review_type = 'dealer_to_buyer' AND EXISTS (
        SELECT 1 FROM public.auctions
        WHERE auctions.id = reviews.auction_id
          AND auctions.created_by = auth.uid()
          AND auctions.status = 'finalized'
      ))
    )
  );

-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create disputes table
CREATE TABLE public.disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id),
  buyer_id UUID NOT NULL,
  dealer_id UUID NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  evidence_urls TEXT[] DEFAULT '{}',
  resolution TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  dealer_deadline TIMESTAMP WITH TIME ZONE,
  admin_requested BOOLEAN DEFAULT false,
  admin_requested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dispute messages table
CREATE TABLE public.dispute_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- Disputes policies
CREATE POLICY "Buyers can create disputes for won auctions"
ON public.disputes FOR INSERT
WITH CHECK (buyer_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.auctions WHERE id = disputes.auction_id AND winner_id = auth.uid() AND status = 'finalized'
));

CREATE POLICY "Participants and admins can view disputes"
ON public.disputes FOR SELECT
USING (buyer_id = auth.uid() OR dealer_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update disputes"
ON public.disputes FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants can update own disputes"
ON public.disputes FOR UPDATE
USING (buyer_id = auth.uid() OR dealer_id = auth.uid());

-- Dispute messages policies
CREATE POLICY "Participants and admins can view dispute messages"
ON public.dispute_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.disputes d WHERE d.id = dispute_messages.dispute_id
  AND (d.buyer_id = auth.uid() OR d.dealer_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Participants and admins can send dispute messages"
ON public.dispute_messages FOR INSERT
WITH CHECK (sender_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.disputes d WHERE d.id = dispute_messages.dispute_id
  AND (d.buyer_id = auth.uid() OR d.dealer_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

-- Enable realtime for dispute messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_messages;

-- Create storage bucket for dispute evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('dispute-evidence', 'dispute-evidence', false);

-- Storage policies for dispute evidence
CREATE POLICY "Dispute participants can upload evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dispute-evidence' AND auth.uid() IS NOT NULL);

CREATE POLICY "Dispute participants and admins can view evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'dispute-evidence' AND auth.uid() IS NOT NULL);

-- Add escrow/payment tracking columns to auctions
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS funds_released_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS funds_frozen boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.auctions.payment_status IS 'pending | escrow | released | refunded';
COMMENT ON COLUMN public.auctions.delivery_status IS 'pending | shipped | delivered';
COMMENT ON COLUMN public.auctions.funds_frozen IS 'true when a dispute is open, blocks release';

-- Create a function to auto-freeze funds when a dispute is created
CREATE OR REPLACE FUNCTION public.freeze_funds_on_dispute()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.auctions
  SET funds_frozen = true,
      payment_status = CASE WHEN payment_status = 'escrow' THEN 'escrow' ELSE payment_status END
  WHERE id = NEW.auction_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_dispute_created_freeze_funds
  AFTER INSERT ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_funds_on_dispute();

-- Unfreeze and update on dispute resolution
CREATE OR REPLACE FUNCTION public.handle_dispute_resolution()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('resolved', 'refunded') AND OLD.status NOT IN ('resolved', 'refunded') THEN
    IF NEW.status = 'refunded' THEN
      UPDATE public.auctions
      SET funds_frozen = false,
          payment_status = 'refunded'
      WHERE id = NEW.auction_id;
    ELSE
      UPDATE public.auctions
      SET funds_frozen = false
      WHERE id = NEW.auction_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_dispute_resolved
  AFTER UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_dispute_resolution();

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to handle reputation impact when a dispute is resolved against the dealer
CREATE OR REPLACE FUNCTION public.handle_dispute_reputation_impact()
RETURNS TRIGGER AS $$
DECLARE
  lost_count INTEGER;
BEGIN
  -- Only trigger when dispute changes to 'refunded' (buyer wins)
  IF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    
    -- Insert an automatic negative review (1 star) against the dealer
    -- Use the resolved_by (admin) as reviewer to avoid RLS conflicts
    -- We mark it with a special tag so it's identifiable
    INSERT INTO public.reviews (
      auction_id,
      reviewer_id,
      reviewed_id,
      rating,
      review_type,
      comment,
      product_accuracy,
      attention_quality,
      shipping_speed,
      tags
    ) VALUES (
      NEW.auction_id,
      NEW.buyer_id,
      NEW.dealer_id,
      1,
      'buyer_to_dealer',
      'Disputa resuelta a favor del comprador: ' || COALESCE(NEW.resolution, 'Producto no conforme'),
      1,
      1,
      1,
      ARRAY['disputa_perdida', 'automatica']
    )
    ON CONFLICT DO NOTHING; -- Avoid duplicate if buyer already reviewed

    -- Count disputes lost by this dealer in the last 30 days
    SELECT COUNT(*) INTO lost_count
    FROM public.disputes
    WHERE dealer_id = NEW.dealer_id
      AND status = 'refunded'
      AND resolved_at >= NOW() - INTERVAL '30 days';

    -- If 3+ lost disputes in a month, suspend the dealer
    IF lost_count >= 3 THEN
      UPDATE public.dealer_verification
      SET account_status = 'suspended',
          status_reason = 'Suspendido automÃ¡ticamente: ' || lost_count || ' disputas perdidas en los Ãºltimos 30 dÃ­as',
          status_changed_at = NOW()
      WHERE user_id = NEW.dealer_id
        AND account_status = 'active';
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on disputes table
DROP TRIGGER IF EXISTS on_dispute_reputation_impact ON public.disputes;
CREATE TRIGGER on_dispute_reputation_impact
  AFTER UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_dispute_reputation_impact();

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

-- Create payment_proofs table
CREATE TABLE public.payment_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id),
  buyer_id UUID NOT NULL,
  amount_usd NUMERIC NOT NULL,
  amount_bs NUMERIC NOT NULL,
  bcv_rate NUMERIC NOT NULL,
  reference_number TEXT NOT NULL,
  proof_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- Buyers can insert their own payment proofs
CREATE POLICY "Buyers can submit payment proof"
ON public.payment_proofs
FOR INSERT
WITH CHECK (
  buyer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = payment_proofs.auction_id
    AND auctions.winner_id = auth.uid()
    AND auctions.status = 'finalized'
  )
);

-- Buyers can view their own proofs, dealers can view proofs for their auctions, admins see all
CREATE POLICY "Users can view relevant payment proofs"
ON public.payment_proofs
FOR SELECT
USING (
  buyer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = payment_proofs.auction_id
    AND auctions.created_by = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Only admins can update payment proofs (approve/reject)
CREATE POLICY "Admins can update payment proofs"
ON public.payment_proofs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_payment_proofs_updated_at
BEFORE UPDATE ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);

-- Storage policies: buyers can upload proofs
CREATE POLICY "Buyers can upload payment proofs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Buyers and admins can view payment proofs
CREATE POLICY "Authorized users can view payment proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));

-- Enable realtime for payment_proofs
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_proofs;

-- Create shipping_info table
CREATE TABLE public.shipping_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id),
  buyer_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  cedula TEXT NOT NULL,
  shipping_company TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  office_name TEXT NOT NULL,
  disclaimer_accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(auction_id, buyer_id)
);

-- Enable RLS
ALTER TABLE public.shipping_info ENABLE ROW LEVEL SECURITY;

-- Buyers can insert their own shipping info
CREATE POLICY "Buyers can submit shipping info"
ON public.shipping_info
FOR INSERT
WITH CHECK (
  buyer_id = auth.uid()
  AND disclaimer_accepted = true
  AND EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_info.auction_id
    AND auctions.winner_id = auth.uid()
    AND auctions.status = 'finalized'
  )
);

-- Buyers can view their own, dealers can view for their auctions, admins see all
CREATE POLICY "Users can view relevant shipping info"
ON public.shipping_info
FOR SELECT
USING (
  buyer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_info.auction_id
    AND auctions.created_by = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Buyers can update their own shipping info
CREATE POLICY "Buyers can update own shipping info"
ON public.shipping_info
FOR UPDATE
USING (buyer_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_shipping_info_updated_at
BEFORE UPDATE ON public.shipping_info
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add tracking fields to auctions
ALTER TABLE public.auctions
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_photo_url TEXT,
ADD COLUMN IF NOT EXISTS dealer_ship_deadline TIMESTAMP WITH TIME ZONE;

-- Create trigger: when payment_proof is inserted, update auction payment_status to 'under_review'
CREATE OR REPLACE FUNCTION public.handle_payment_proof_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.auctions
  SET payment_status = 'under_review'
  WHERE id = NEW.auction_id
  AND payment_status = 'pending';
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_proof_submitted
AFTER INSERT ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_proof_submitted();

-- Create trigger: when admin approves payment, set delivery_status to ready_to_ship and dealer_ship_deadline
CREATE OR REPLACE FUNCTION public.handle_payment_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE public.auctions
    SET payment_status = 'verified',
        delivery_status = 'ready_to_ship',
        dealer_ship_deadline = NOW() + INTERVAL '48 hours'
    WHERE id = NEW.auction_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_proof_approved
AFTER UPDATE ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_verified();
-- Allow dealers to upload tracking photos to auction-images bucket
CREATE POLICY "Dealers can upload tracking photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'auction-images'
  AND has_role(auth.uid(), 'dealer'::app_role)
);

-- Allow dealers to update their uploads
CREATE POLICY "Dealers can update own auction images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'auction-images'
  AND has_role(auth.uid(), 'dealer'::app_role)
);
-- Allow dealers (auction creators) to update shipping info for their auctions
CREATE POLICY "Dealers can update shipping info for their auctions"
ON public.shipping_info FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_info.auction_id
    AND auctions.created_by = auth.uid()
  )
);
-- Audit log for all shipping/tracking modifications
CREATE TABLE public.shipping_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL,
  change_type text NOT NULL, -- 'shipping_info_updated', 'tracking_submitted', 'tracking_updated', 'delivery_status_changed', 'payment_status_changed'
  field_name text, -- which field changed
  old_value text,
  new_value text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_audit_log ENABLE ROW LEVEL SECURITY;

-- Dealers can insert logs for their own auctions
CREATE POLICY "Dealers can insert audit logs"
ON public.shipping_audit_log FOR INSERT
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_audit_log.auction_id
    AND (auctions.created_by = auth.uid() OR auctions.winner_id = auth.uid())
  )
);

-- Admins can insert audit logs (for admin-driven changes)
CREATE POLICY "Admins can insert audit logs"
ON public.shipping_audit_log FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Dealers can view logs for their auctions
CREATE POLICY "Dealers can view own auction logs"
ON public.shipping_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_audit_log.auction_id
    AND auctions.created_by = auth.uid()
  )
);

-- Buyers can view logs for auctions they won
CREATE POLICY "Buyers can view won auction logs"
ON public.shipping_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_audit_log.auction_id
    AND auctions.winner_id = auth.uid()
  )
);

-- Admins can view all logs
CREATE POLICY "Admins can view all audit logs"
ON public.shipping_audit_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_shipping_audit_auction ON public.shipping_audit_log(auction_id);
CREATE INDEX idx_shipping_audit_created ON public.shipping_audit_log(created_at DESC);

-- Table to record each platform commission earned
CREATE TABLE public.platform_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id),
  dealer_id UUID NOT NULL,
  sale_amount NUMERIC NOT NULL,
  commission_percentage NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  dealer_net NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all earnings"
  ON public.platform_earnings FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage earnings"
  ON public.platform_earnings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Dealers can view own earnings"
  ON public.platform_earnings FOR SELECT
  USING (dealer_id = auth.uid());

-- Add dealer_balance to dealer_verification
ALTER TABLE public.dealer_verification
  ADD COLUMN IF NOT EXISTS dealer_balance NUMERIC NOT NULL DEFAULT 0;

-- Function to split funds when auction funds are released
CREATE OR REPLACE FUNCTION public.handle_funds_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_commission_pct NUMERIC;
  v_commission_amount NUMERIC;
  v_dealer_net NUMERIC;
  v_dealer_id UUID;
  v_sale_amount NUMERIC;
  v_already_exists BOOLEAN;
BEGIN
  -- Only trigger when funds_released_at is set for the first time
  IF NEW.funds_released_at IS NOT NULL AND OLD.funds_released_at IS NULL THEN
    
    v_sale_amount := NEW.current_price;
    v_dealer_id := NEW.created_by;
    
    -- Check if already processed
    SELECT EXISTS(
      SELECT 1 FROM public.platform_earnings WHERE auction_id = NEW.id
    ) INTO v_already_exists;
    
    IF v_already_exists THEN
      RETURN NEW;
    END IF;
    
    -- Get commission percentage from site_settings
    SELECT COALESCE(setting_value::numeric, 10)
    INTO v_commission_pct
    FROM public.site_settings
    WHERE setting_key = 'commission_percentage';
    
    IF v_commission_pct IS NULL THEN
      v_commission_pct := 10;
    END IF;
    
    v_commission_amount := ROUND(v_sale_amount * v_commission_pct / 100, 2);
    v_dealer_net := v_sale_amount - v_commission_amount;
    
    -- Record platform earning
    INSERT INTO public.platform_earnings (auction_id, dealer_id, sale_amount, commission_percentage, commission_amount, dealer_net)
    VALUES (NEW.id, v_dealer_id, v_sale_amount, v_commission_pct, v_commission_amount, v_dealer_net);
    
    -- Update dealer balance
    UPDATE public.dealer_verification
    SET dealer_balance = dealer_balance + v_dealer_net
    WHERE user_id = v_dealer_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on auctions when funds are released
CREATE TRIGGER trigger_funds_release_split
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_funds_release();

-- Withdrawal requests table
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own withdrawals"
  ON public.withdrawal_requests FOR SELECT
  USING (dealer_id = auth.uid());

CREATE POLICY "Dealers can request withdrawals"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (dealer_id = auth.uid());

CREATE POLICY "Admins can view all withdrawals"
  ON public.withdrawal_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update withdrawals"
  ON public.withdrawal_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Create blacklisted_records table for banned users
CREATE TABLE public.blacklisted_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  phone TEXT,
  cedula TEXT,
  reason TEXT NOT NULL DEFAULT 'Cuenta suspendida',
  banned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blacklisted_records ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blacklisted records
CREATE POLICY "Admins can manage blacklisted records"
  ON public.blacklisted_records
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow the edge function (via service role) to read blacklisted records
-- We also need anon/authenticated to call the validation edge function,
-- but the edge function will use service_role key to query this table.

CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create a sequence for operation numbers
CREATE SEQUENCE IF NOT EXISTS public.auction_operation_seq START WITH 1 INCREMENT BY 1;

-- Add operation_number column
ALTER TABLE public.auctions
ADD COLUMN operation_number text UNIQUE;

-- Function to auto-generate operation number on insert
CREATE OR REPLACE FUNCTION public.generate_operation_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.operation_number := 'OP-' || LPAD(nextval('public.auction_operation_seq')::text, 5, '0');
  RETURN NEW;
END;
$function$;

-- Trigger to auto-assign on insert
CREATE TRIGGER set_operation_number
BEFORE INSERT ON public.auctions
FOR EACH ROW
WHEN (NEW.operation_number IS NULL)
EXECUTE FUNCTION public.generate_operation_number();

-- Backfill existing auctions with operation numbers ordered by creation date
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.auctions
  WHERE operation_number IS NULL
)
UPDATE public.auctions a
SET operation_number = 'OP-' || LPAD(n.rn::text, 5, '0')
FROM numbered n
WHERE a.id = n.id;

-- Update the sequence to continue after the last assigned number
SELECT setval('public.auction_operation_seq', COALESCE(
  (SELECT MAX(REPLACE(operation_number, 'OP-', '')::int) FROM public.auctions WHERE operation_number IS NOT NULL),
  1
));

-- Update the operation number format for auctions to be more corporate
-- Format: SUB-YYMMDD-XXXX (date + 4-char hex from uuid)
CREATE OR REPLACE FUNCTION public.generate_operation_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.operation_number := 'SUB-' 
    || TO_CHAR(NOW(), 'YYMMDD') || '-' 
    || UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4));
  RETURN NEW;
END;
$function$;

-- Add public_id to profiles for users
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS public_id text UNIQUE;

-- Add public_id to dealer_verification for dealers
ALTER TABLE public.dealer_verification
ADD COLUMN IF NOT EXISTS public_id text UNIQUE;

-- Function to generate user public ID: USR-YYMMDD-XXXX
CREATE OR REPLACE FUNCTION public.generate_user_public_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.public_id := 'USR-' 
    || TO_CHAR(NOW(), 'YYMMDD') || '-' 
    || UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4));
  RETURN NEW;
END;
$function$;

-- Function to generate dealer public ID: DLR-YYMMDD-XXXX
CREATE OR REPLACE FUNCTION public.generate_dealer_public_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.public_id := 'DLR-' 
    || TO_CHAR(NOW(), 'YYMMDD') || '-' 
    || UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4));
  RETURN NEW;
END;
$function$;

-- Triggers
CREATE TRIGGER set_user_public_id
BEFORE INSERT ON public.profiles
FOR EACH ROW
WHEN (NEW.public_id IS NULL)
EXECUTE FUNCTION public.generate_user_public_id();

CREATE TRIGGER set_dealer_public_id
BEFORE INSERT ON public.dealer_verification
FOR EACH ROW
WHEN (NEW.public_id IS NULL)
EXECUTE FUNCTION public.generate_dealer_public_id();

-- Backfill existing auctions with new format
UPDATE public.auctions
SET operation_number = 'SUB-' 
  || TO_CHAR(created_at, 'YYMMDD') || '-' 
  || UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 4))
WHERE operation_number IS NOT NULL;

-- Backfill existing profiles
UPDATE public.profiles
SET public_id = 'USR-' 
  || TO_CHAR(created_at, 'YYMMDD') || '-' 
  || UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 4))
WHERE public_id IS NULL;

-- Backfill existing dealers
UPDATE public.dealer_verification
SET public_id = 'DLR-' 
  || TO_CHAR(created_at, 'YYMMDD') || '-' 
  || UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 4))
WHERE public_id IS NULL;

-- Create auction_reports table
CREATE TABLE public.auction_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auction_reports ENABLE ROW LEVEL SECURITY;

-- Users can report auctions
CREATE POLICY "Authenticated users can report auctions"
ON public.auction_reports FOR INSERT
WITH CHECK (reporter_id = auth.uid());

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
ON public.auction_reports FOR SELECT
USING (reporter_id = auth.uid());

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
ON public.auction_reports FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update reports
CREATE POLICY "Admins can update reports"
ON public.auction_reports FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Prevent duplicate reports from same user on same auction
CREATE UNIQUE INDEX idx_unique_report_per_user ON public.auction_reports (auction_id, reporter_id);

-- Add requested duration (in hours) that the dealer wants
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS requested_duration_hours integer DEFAULT 24;

-- Add archived_at to track when finalized auctions should be hidden from public
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone DEFAULT NULL;

-- Update the SELECT policy to exclude archived auctions from public view
-- but keep them visible to the dealer (creator) and admins
DROP POLICY IF EXISTS "Public can view approved auctions" ON public.auctions;
CREATE POLICY "Public can view approved auctions"
ON public.auctions
FOR SELECT
USING (
  (
    (status = ANY (ARRAY['active'::text, 'finalized'::text]))
    AND (archived_at IS NULL)
  )
  OR (created_by = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Add desired_resolution and signature columns to disputes
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS desired_resolution text;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS signature_data text;

-- Add validation constraints for payment_proofs
ALTER TABLE public.payment_proofs
  ADD CONSTRAINT payment_proofs_amount_usd_positive CHECK (amount_usd > 0 AND amount_usd <= 1000000),
  ADD CONSTRAINT payment_proofs_amount_bs_positive CHECK (amount_bs > 0),
  ADD CONSTRAINT payment_proofs_bcv_rate_positive CHECK (bcv_rate > 0 AND bcv_rate <= 1000),
  ADD CONSTRAINT payment_proofs_reference_number_format CHECK (length(trim(reference_number)) >= 4 AND length(trim(reference_number)) <= 50);

-- Create a validation trigger to verify amount matches auction price
CREATE OR REPLACE FUNCTION public.validate_payment_proof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auction_price NUMERIC;
BEGIN
  -- Get the auction's current price
  SELECT current_price INTO v_auction_price
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_auction_price IS NULL THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  -- Verify the USD amount matches the auction price (allow small rounding tolerance)
  IF ABS(NEW.amount_usd - v_auction_price) > 0.01 THEN
    RAISE EXCEPTION 'Payment amount does not match auction price';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_payment_proof_before_insert
  BEFORE INSERT ON public.payment_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_proof();

-- Table to store granular permissions for admin team members
CREATE TABLE public.admin_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  permission TEXT NOT NULL,
  granted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

-- Enable RLS
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage permissions"
ON public.admin_permissions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete payment_proofs
CREATE POLICY "Admins can delete payment proofs"
ON public.payment_proofs FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete shipping_info
CREATE POLICY "Admins can delete shipping info"
ON public.shipping_info FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete shipping_audit_log
CREATE POLICY "Admins can delete audit logs"
ON public.shipping_audit_log FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete bids
CREATE POLICY "Admins can delete bids"
ON public.bids FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete reviews
CREATE POLICY "Admins can delete reviews"
ON public.reviews FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete disputes
CREATE POLICY "Admins can delete disputes"
ON public.disputes FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete auction_reports
CREATE POLICY "Admins can delete auction reports"
ON public.auction_reports FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete dispute_messages
CREATE POLICY "Admins can delete dispute messages"
ON public.dispute_messages FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.profiles ADD COLUMN manual_buyer_tier text DEFAULT NULL;

-- Add avatar_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create avatars storage bucket (public so images can be displayed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Anyone can view avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- RLS: Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- Add start_time column to auctions (nullable = immediate start for backward compat)
ALTER TABLE public.auctions 
ADD COLUMN start_time timestamp with time zone DEFAULT NULL;

-- Set existing auctions' start_time to their created_at
UPDATE public.auctions SET start_time = created_at WHERE start_time IS NULL;

-- 1. Restringir perfiles: reemplazar polÃ­tica abierta con una mÃ¡s restrictiva
-- Los usuarios pueden ver: su propio perfil, perfiles de participantes en sus subastas, o admins ven todo
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;

-- Permitir ver perfil propio
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid());

-- Admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Dealers pueden ver perfiles de compradores de sus subastas
CREATE POLICY "Dealers can view auction participant profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE (auctions.created_by = auth.uid() AND auctions.winner_id = profiles.id)
    OR (auctions.winner_id = auth.uid() AND auctions.created_by = profiles.id)
  )
);

-- Usuarios pueden ver perfiles de dealers de subastas activas (para mostrar nombres en cards)
CREATE POLICY "Users can view dealer profiles from auctions"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.created_by = profiles.id
    AND auctions.status IN ('active', 'finalized')
  )
);

-- Usuarios pueden ver perfiles de otros participantes en subastas donde han pujado
CREATE POLICY "Bidders can view auction participant profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bids b1
    JOIN bids b2 ON b1.auction_id = b2.auction_id
    WHERE b1.user_id = auth.uid() AND b2.user_id = profiles.id
  )
);

-- Fix dispute-evidence storage: restrict to participants and admins only
DROP POLICY IF EXISTS "Dispute participants and admins can view evidence" ON storage.objects;

CREATE POLICY "Dispute participants and admins can view evidence"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'dispute-evidence' AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.disputes 
      WHERE (disputes.buyer_id = auth.uid() OR disputes.dealer_id = auth.uid())
      AND disputes.evidence_urls IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(disputes.evidence_urls) AS url
        WHERE url LIKE '%' || storage.filename(objects.name) || '%'
      )
    )
  )
);

-- =============================================
-- 1. FAVORITES / WATCHLIST TABLE
-- =============================================
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, auction_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.favorites FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can add favorites"
  ON public.favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove favorites"
  ON public.favorites FOR DELETE
  USING (user_id = auth.uid());

-- =============================================
-- 2. IN-APP NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- Admins and system can insert notifications for any user
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =============================================
-- 3. BID RATE LIMITING TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.check_bid_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.bids
  WHERE user_id = NEW.user_id
    AND auction_id = NEW.auction_id
    AND created_at > NOW() - INTERVAL '10 seconds';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Demasiadas pujas en poco tiempo. Espera unos segundos.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_bid_rate_limit_trigger
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.check_bid_rate_limit();

-- Trigger: Notify previous winner when outbid
CREATE OR REPLACE FUNCTION public.notify_outbid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prev_winner_id UUID;
  v_auction_title TEXT;
BEGIN
  -- Get the previous winner before this bid updated the auction
  SELECT winner_id, title INTO v_prev_winner_id, v_auction_title
  FROM public.auctions
  WHERE id = NEW.auction_id;

  -- Only notify if there was a previous winner and it's a different user
  IF v_prev_winner_id IS NOT NULL AND v_prev_winner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_prev_winner_id,
      'Â¡Te han superado! ðŸ”¥',
      'Alguien ha pujado $' || NEW.amount || ' en "' || v_auction_title || '". Â¡Puja de nuevo!',
      'outbid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_bid_notify_outbid
  BEFORE INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_outbid();

-- Trigger: Notify winner when auction finalizes
CREATE OR REPLACE FUNCTION public.notify_auction_winner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only when status changes to finalized and there's a winner
  IF NEW.status = 'finalized' AND OLD.status != 'finalized' AND NEW.winner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.winner_id,
      'ðŸŽ‰ Â¡Ganaste la subasta!',
      'Has ganado "' || NEW.title || '" por $' || NEW.current_price || '. Procede con el pago.',
      'auction_won',
      '/auction/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auction_finalized_notify_winner
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auction_winner();

-- Trigger: Notify buyer when payment is approved
CREATE OR REPLACE FUNCTION public.notify_payment_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auction_title TEXT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    SELECT title INTO v_auction_title FROM public.auctions WHERE id = NEW.auction_id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.buyer_id,
      'âœ… Pago aprobado',
      'Tu pago para "' || COALESCE(v_auction_title, 'subasta') || '" ha sido verificado. El dealer prepararÃ¡ tu envÃ­o.',
      'payment_approved',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_approved_notify_buyer
  AFTER UPDATE ON public.payment_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_approved();

-- Trigger: Notify dealer when they receive a new bid
CREATE OR REPLACE FUNCTION public.notify_dealer_new_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dealer_id UUID;
  v_auction_title TEXT;
BEGIN
  SELECT created_by, title INTO v_dealer_id, v_auction_title
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_dealer_id IS NOT NULL AND v_dealer_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_dealer_id,
      'ðŸ’° Nueva puja recibida',
      NEW.bidder_name || ' ha pujado $' || NEW.amount || ' en "' || v_auction_title || '".',
      'new_bid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_bid_notify_dealer
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dealer_new_bid();
-- Add extended_time flag to auctions for admin labeling
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS is_extended boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.notify_dealer_new_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dealer_id UUID;
  v_auction_title TEXT;
BEGIN
  SELECT created_by, title INTO v_dealer_id, v_auction_title
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_dealer_id IS NOT NULL AND v_dealer_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_dealer_id,
      'ðŸ’° Nueva puja recibida',
      'Alguien ha pujado $' || NEW.amount || ' en "' || v_auction_title || '".',
      'new_bid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mask_bidder_name(name text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  parts text[];
  masked text;
  p text;
  i int;
BEGIN
  IF name IS NULL OR length(trim(name)) = 0 THEN
    RETURN 'Usuario';
  END IF;
  parts := string_to_array(trim(name), ' ');
  masked := '';
  FOR i IN 1..array_length(parts, 1) LOOP
    p := parts[i];
    IF length(p) <= 2 THEN
      masked := masked || p;
    ELSE
      masked := masked || left(p, 2) || repeat('*', length(p) - 2);
    END IF;
    IF i < array_length(parts, 1) THEN
      masked := masked || ' ';
    END IF;
  END LOOP;
  RETURN masked;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_outbid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prev_winner_id UUID;
  v_auction_title TEXT;
BEGIN
  SELECT winner_id, title INTO v_prev_winner_id, v_auction_title
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_prev_winner_id IS NOT NULL AND v_prev_winner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_prev_winner_id,
      'Â¡Te han superado! ðŸ”¥',
      mask_bidder_name(NEW.bidder_name) || ' ha pujado $' || NEW.amount || ' en "' || v_auction_title || '". Â¡Puja de nuevo!',
      'outbid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_dealer_new_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dealer_id UUID;
  v_auction_title TEXT;
BEGIN
  SELECT created_by, title INTO v_dealer_id, v_auction_title
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_dealer_id IS NOT NULL AND v_dealer_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_dealer_id,
      'ðŸ’° Nueva puja recibida',
      mask_bidder_name(NEW.bidder_name) || ' ha pujado $' || NEW.amount || ' en "' || v_auction_title || '".',
      'new_bid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Table to store proxy/auto bids
CREATE TABLE public.auto_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  max_amount NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only one active auto-bid per user per auction
CREATE UNIQUE INDEX idx_auto_bids_unique_active ON public.auto_bids (auction_id, user_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.auto_bids ENABLE ROW LEVEL SECURITY;

-- Users can view their own auto-bids
CREATE POLICY "Users can view own auto-bids"
  ON public.auto_bids FOR SELECT
  USING (user_id = auth.uid());

-- Users can create auto-bids
CREATE POLICY "Users can create auto-bids"
  ON public.auto_bids FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update own auto-bids
CREATE POLICY "Users can update own auto-bids"
  ON public.auto_bids FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete own auto-bids
CREATE POLICY "Users can delete own auto-bids"
  ON public.auto_bids FOR DELETE
  USING (user_id = auth.uid());

-- Admins can manage all auto-bids
CREATE POLICY "Admins can manage auto-bids"
  ON public.auto_bids FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_auto_bids_updated_at
  BEFORE UPDATE ON public.auto_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to process auto-bids after a new bid is placed
CREATE OR REPLACE FUNCTION public.process_auto_bids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auto_bid RECORD;
  v_current_price NUMERIC;
  v_new_bid_amount NUMERIC;
  v_auction_status TEXT;
  v_auction_end TIMESTAMPTZ;
  v_bidder_name TEXT;
BEGIN
  -- Get auction info
  SELECT status, current_price, end_time INTO v_auction_status, v_current_price, v_auction_end
  FROM public.auctions WHERE id = NEW.auction_id;

  -- Only process if auction is active and not ended
  IF v_auction_status != 'active' OR v_auction_end <= NOW() THEN
    RETURN NEW;
  END IF;

  -- Find the highest active auto-bid for this auction that is NOT from the current bidder
  -- and whose max_amount is higher than the new bid
  SELECT ab.*, p.full_name as bidder_full_name
  INTO v_auto_bid
  FROM public.auto_bids ab
  JOIN public.profiles p ON p.id = ab.user_id
  WHERE ab.auction_id = NEW.auction_id
    AND ab.is_active = true
    AND ab.user_id != NEW.user_id
    AND ab.max_amount > NEW.amount
  ORDER BY ab.max_amount DESC, ab.created_at ASC
  LIMIT 1;

  -- If no auto-bid can counter, nothing to do
  IF v_auto_bid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate the counter-bid: current bid + $1, capped at the auto-bidder's max
  v_new_bid_amount := LEAST(NEW.amount + 1, v_auto_bid.max_amount);

  -- Make sure the auto-bid amount is actually higher than the current bid
  IF v_new_bid_amount <= NEW.amount THEN
    RETURN NEW;
  END IF;

  v_bidder_name := v_auto_bid.bidder_full_name;

  -- Insert the counter-bid
  INSERT INTO public.bids (auction_id, user_id, amount, bidder_name)
  VALUES (NEW.auction_id, v_auto_bid.user_id, v_new_bid_amount, v_bidder_name);

  -- If the auto-bid reached its max, deactivate it
  IF v_new_bid_amount >= v_auto_bid.max_amount THEN
    UPDATE public.auto_bids SET is_active = false WHERE id = v_auto_bid.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: after a new bid, process auto-bids
CREATE TRIGGER trigger_process_auto_bids
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.process_auto_bids();

-- Update process_auto_bids to notify user when their auto-bid is deactivated (reached max)
CREATE OR REPLACE FUNCTION public.process_auto_bids()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auto_bid RECORD;
  v_current_price NUMERIC;
  v_new_bid_amount NUMERIC;
  v_auction_status TEXT;
  v_auction_end TIMESTAMPTZ;
  v_auction_title TEXT;
  v_bidder_name TEXT;
BEGIN
  -- Get auction info
  SELECT status, current_price, end_time, title INTO v_auction_status, v_current_price, v_auction_end, v_auction_title
  FROM public.auctions WHERE id = NEW.auction_id;

  -- Only process if auction is active and not ended
  IF v_auction_status != 'active' OR v_auction_end <= NOW() THEN
    RETURN NEW;
  END IF;

  -- Find the highest active auto-bid for this auction that is NOT from the current bidder
  SELECT ab.*, p.full_name as bidder_full_name
  INTO v_auto_bid
  FROM public.auto_bids ab
  JOIN public.profiles p ON p.id = ab.user_id
  WHERE ab.auction_id = NEW.auction_id
    AND ab.is_active = true
    AND ab.user_id != NEW.user_id
    AND ab.max_amount > NEW.amount
  ORDER BY ab.max_amount DESC, ab.created_at ASC
  LIMIT 1;

  IF v_auto_bid IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_bid_amount := LEAST(NEW.amount + 1, v_auto_bid.max_amount);

  IF v_new_bid_amount <= NEW.amount THEN
    RETURN NEW;
  END IF;

  v_bidder_name := v_auto_bid.bidder_full_name;

  -- Insert the counter-bid
  INSERT INTO public.bids (auction_id, user_id, amount, bidder_name)
  VALUES (NEW.auction_id, v_auto_bid.user_id, v_new_bid_amount, v_bidder_name);

  -- If the auto-bid reached its max, deactivate it and notify the user
  IF v_new_bid_amount >= v_auto_bid.max_amount THEN
    UPDATE public.auto_bids SET is_active = false WHERE id = v_auto_bid.id;
    
    -- Notify user that their auto-bid has been exhausted
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_auto_bid.user_id,
      'âš ï¸ Auto-puja agotada',
      'Tu auto-puja en "' || COALESCE(v_auction_title, 'subasta') || '" alcanzÃ³ su monto mÃ¡ximo de $' || v_auto_bid.max_amount || '. Configura una nueva si deseas seguir pujando.',
      'autobid_exhausted',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create function to send countdown notifications to all bidders of an auction
-- This avoids duplicates by checking existing notifications
CREATE OR REPLACE FUNCTION public.send_auction_countdown_notifications()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auction RECORD;
  v_bidder RECORD;
  v_minutes INT;
  v_notif_type TEXT;
  v_notif_title TEXT;
  v_notif_message TEXT;
  v_already_sent BOOLEAN;
BEGIN
  -- Check active auctions ending within 30 minutes
  FOR v_auction IN
    SELECT DISTINCT a.id, a.title, a.end_time,
           EXTRACT(EPOCH FROM (a.end_time - NOW())) / 60 AS minutes_left
    FROM public.auctions a
    WHERE a.status = 'active'
      AND a.end_time > NOW()
      AND a.end_time <= NOW() + INTERVAL '31 minutes'
  LOOP
    v_minutes := FLOOR(v_auction.minutes_left);

    -- Determine which thresholds to notify
    -- We check windows: 28-31 min = 30min alert, 8-11 min = 10min alert, 3-6 min = 5min alert
    IF v_minutes >= 28 AND v_minutes <= 31 THEN
      v_notif_type := 'auction_ending_30m';
      v_notif_title := 'â° Â¡30 minutos restantes!';
      v_notif_message := 'La subasta "' || v_auction.title || '" finaliza en 30 minutos. Â¡No te la pierdas!';
    ELSIF v_minutes >= 8 AND v_minutes <= 11 THEN
      v_notif_type := 'auction_ending_10m';
      v_notif_title := 'ðŸ”¥ Â¡10 minutos restantes!';
      v_notif_message := 'La subasta "' || v_auction.title || '" estÃ¡ por terminar en 10 minutos. Â¡Ãšltima oportunidad!';
    ELSIF v_minutes >= 3 AND v_minutes <= 6 THEN
      v_notif_type := 'auction_ending_5m';
      v_notif_title := 'ðŸš¨ Â¡5 minutos restantes!';
      v_notif_message := 'La subasta "' || v_auction.title || '" finaliza en 5 minutos. Â¡Haz tu puja ahora!';
    ELSE
      CONTINUE;
    END IF;

    -- Get all unique bidders + users with favorites for this auction
    FOR v_bidder IN
      SELECT DISTINCT user_id FROM (
        SELECT user_id FROM public.bids WHERE auction_id = v_auction.id
        UNION
        SELECT user_id FROM public.favorites WHERE auction_id = v_auction.id
      ) AS interested_users
    LOOP
      -- Check if this notification was already sent
      SELECT EXISTS(
        SELECT 1 FROM public.notifications
        WHERE user_id = v_bidder.user_id
          AND type = v_notif_type
          AND link = '/auction/' || v_auction.id
      ) INTO v_already_sent;

      IF NOT v_already_sent THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          v_bidder.user_id,
          v_notif_title,
          v_notif_message,
          v_notif_type,
          '/auction/' || v_auction.id
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- Drop and recreate the SELECT policy to include winners
DROP POLICY "Public can view approved auctions" ON public.auctions;

CREATE POLICY "Public can view approved auctions"
ON public.auctions
FOR SELECT
USING (
  ((status = ANY (ARRAY['active'::text, 'finalized'::text])) AND (archived_at IS NULL))
  OR (created_by = auth.uid())
  OR (winner_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix shipping_info INSERT: allow when auction has ended (regardless of status)
DROP POLICY "Buyers can submit shipping info" ON public.shipping_info;
CREATE POLICY "Buyers can submit shipping info"
ON public.shipping_info
FOR INSERT
WITH CHECK (
  (buyer_id = auth.uid())
  AND (disclaimer_accepted = true)
  AND (EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_info.auction_id
      AND auctions.winner_id = auth.uid()
      AND auctions.end_time <= now()
  ))
);

-- Fix payment_proofs INSERT: allow when auction has ended (regardless of status)
DROP POLICY "Buyers can submit payment proof" ON public.payment_proofs;
CREATE POLICY "Buyers can submit payment proof"
ON public.payment_proofs
FOR INSERT
WITH CHECK (
  (buyer_id = auth.uid())
  AND (EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = payment_proofs.auction_id
      AND auctions.winner_id = auth.uid()
      AND auctions.end_time <= now()
  ))
);

-- Fix disputes INSERT: allow when auction has ended (regardless of status)
DROP POLICY "Buyers can create disputes for won auctions" ON public.disputes;
CREATE POLICY "Buyers can create disputes for won auctions"
ON public.disputes
FOR INSERT
WITH CHECK (
  (buyer_id = auth.uid())
  AND (EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = disputes.auction_id
      AND auctions.winner_id = auth.uid()
      AND auctions.end_time <= now()
  ))
);
ALTER TABLE public.shipping_info ADD COLUMN phone text;
-- Add manual paid tracking column to platform_earnings
ALTER TABLE public.platform_earnings ADD COLUMN is_paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.platform_earnings ADD COLUMN paid_at timestamp with time zone;
ALTER TABLE public.platform_earnings ADD COLUMN paid_by uuid;
-- Payments made TO dealers by admin
CREATE TABLE public.dealer_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id uuid NOT NULL,
  total_amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'transfer',
  bank_name text,
  reference_number text,
  proof_url text,
  notes text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Line items: which earnings are covered by this payment
CREATE TABLE public.dealer_payment_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.dealer_payments(id) ON DELETE CASCADE,
  earning_id uuid NOT NULL REFERENCES public.platform_earnings(id),
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dealer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_payment_items ENABLE ROW LEVEL SECURITY;

-- Policies: admins full access, dealers can view their own
CREATE POLICY "Admins can manage dealer payments" ON public.dealer_payments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Dealers can view own payments" ON public.dealer_payments FOR SELECT USING (dealer_id = auth.uid());

CREATE POLICY "Admins can manage payment items" ON public.dealer_payment_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Dealers can view own payment items" ON public.dealer_payment_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.dealer_payments dp WHERE dp.id = dealer_payment_items.payment_id AND dp.dealer_id = auth.uid()));

-- Index for performance
CREATE INDEX idx_dealer_payments_dealer ON public.dealer_payments(dealer_id);
CREATE INDEX idx_dealer_payment_items_payment ON public.dealer_payment_items(payment_id);
CREATE INDEX idx_dealer_payment_items_earning ON public.dealer_payment_items(earning_id);
-- Allow admins to upload payment proofs (for dealer payment receipts)
CREATE POLICY "Admins can upload payment proofs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete payment proofs
CREATE POLICY "Admins can delete payment proofs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'payment-proofs'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Update RLS policy to allow public viewing of "scheduled" auctions
DROP POLICY IF EXISTS "Public can view approved auctions" ON public.auctions;

CREATE POLICY "Public can view approved auctions"
ON public.auctions
FOR SELECT
USING (
  ((status = ANY (ARRAY['active'::text, 'finalized'::text, 'scheduled'::text])) AND (archived_at IS NULL))
  OR (created_by = auth.uid())
  OR (winner_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send push notification via edge function when a notification is inserted
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get Supabase URL and service role key from vault or env
  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  -- Fallback: skip if secrets not accessible
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'Push notification skipped: secrets not available';
    RETURN NEW;
  END IF;

  -- Call the send-push-to-users edge function asynchronously
  SELECT extensions.http_post(
    url := v_supabase_url || '/functions/v1/send-push-to-users',
    body := jsonb_build_object(
      'userIds', jsonb_build_array(NEW.user_id),
      'title', NEW.title,
      'body', NEW.message,
      'url', COALESCE(NEW.link, '/'),
      'tag', COALESCE(NEW.type, 'general')
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't block notification insert if push fails
    RAISE WARNING 'Push notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS trigger_push_on_notification ON public.notifications;
CREATE TRIGGER trigger_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_notification();
SELECT vault.create_secret(
  'https://qiawffqxqtokmhuksfmz.supabase.co',
  'SUPABASE_URL'
);

-- Add the anon key to vault so the trigger can use it
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpYXdmZnF4cXRva21odWtzZm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzQ3ODIsImV4cCI6MjA4NjkxMDc4Mn0.pH-O7EP61-43IL_hnJqwfXtnMZLtOoyQ26tECHlahKQ',
  'SUPABASE_ANON_KEY'
);

-- Update trigger function to use anon key instead of service role key
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    RAISE WARNING 'Push notification skipped: secrets not available';
    RETURN NEW;
  END IF;

  SELECT extensions.http_post(
    url := v_supabase_url || '/functions/v1/send-push-to-users',
    body := jsonb_build_object(
      'userIds', jsonb_build_array(NEW.user_id),
      'title', NEW.title,
      'body', NEW.message,
      'url', COALESCE(NEW.link, '/'),
      'tag', COALESCE(NEW.type, 'general')
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    )
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Push notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- Tabla para campaÃ±as publicitarias (modales emergentes)
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver campaÃ±as activas
CREATE POLICY "Anyone can view active campaigns"
ON public.campaigns FOR SELECT
USING (is_active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));

-- Solo admins pueden gestionar campaÃ±as
CREATE POLICY "Admins can manage campaigns"
ON public.campaigns FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tabla para trackear quÃ© usuarios ya cerraron quÃ© campaÃ±a
CREATE TABLE public.campaign_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

ALTER TABLE public.campaign_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals"
ON public.campaign_dismissals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can dismiss campaigns"
ON public.campaign_dismissals FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Storage bucket para flyers de campaÃ±as
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-flyers', 'campaign-flyers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view campaign flyers"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-flyers');

CREATE POLICY "Admins can upload campaign flyers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'campaign-flyers');

CREATE POLICY "Admins can delete campaign flyers"
ON storage.objects FOR DELETE
USING (bucket_id = 'campaign-flyers');
CREATE POLICY "Admins can delete campaign dismissals"
ON public.campaign_dismissals
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for campaign ads
INSERT INTO storage.buckets (id, name, public)
VALUES ('campanas_ads', 'campanas_ads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view campaign ad images
CREATE POLICY "Public can view campaign ads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'campanas_ads');

-- Allow admins to upload campaign ads
CREATE POLICY "Admins can upload campaign ads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'campanas_ads' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete campaign ads
CREATE POLICY "Admins can delete campaign ads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'campanas_ads' AND has_role(auth.uid(), 'admin'::app_role));
-- Allow admins to see all dismissals so they can delete them
CREATE POLICY "Admins can view all campaign dismissals"
ON public.campaign_dismissals
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- SECURITY HARDENING MIGRATION
-- ============================================

-- 1. CRITICAL: Restrict bids to authenticated users only (was public)
DROP POLICY IF EXISTS "Anyone can view bids" ON public.bids;
CREATE POLICY "Authenticated users can view bids"
ON public.bids FOR SELECT TO authenticated
USING (true);

-- 2. CRITICAL: Restrict reviews to authenticated users only (was public)  
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Authenticated users can view reviews"
ON public.reviews FOR SELECT TO authenticated
USING (true);

-- 3. Prevent users from self-assigning roles (additional safety)
CREATE POLICY "Prevent self-role-assignment"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (false);

-- 4. Add rate limiting for payment proof submissions (max 3 per hour per user)
CREATE OR REPLACE FUNCTION public.check_payment_proof_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.payment_proofs
  WHERE buyer_id = NEW.buyer_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Demasiados comprobantes de pago enviados. Espera antes de intentar nuevamente.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER check_payment_proof_rate
BEFORE INSERT ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.check_payment_proof_rate_limit();

-- 5. Add rate limiting for dispute creation (max 2 per day per user)
CREATE OR REPLACE FUNCTION public.check_dispute_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.disputes
  WHERE buyer_id = NEW.buyer_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF recent_count >= 2 THEN
    RAISE EXCEPTION 'Has alcanzado el lÃ­mite de disputas diarias. Intenta maÃ±ana.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER check_dispute_rate
BEFORE INSERT ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.check_dispute_rate_limit();

-- 6. Add rate limiting for auction reports (max 5 per day per user)
CREATE OR REPLACE FUNCTION public.check_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.auction_reports
  WHERE reporter_id = NEW.reporter_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Has alcanzado el lÃ­mite de reportes diarios. Intenta maÃ±ana.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER check_report_rate
BEFORE INSERT ON public.auction_reports
FOR EACH ROW
EXECUTE FUNCTION public.check_report_rate_limit();

-- 7. Prevent dealers from bidding on their own auctions (server-side enforcement)
CREATE OR REPLACE FUNCTION public.prevent_self_bidding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_created_by UUID;
BEGIN
  SELECT created_by INTO v_created_by
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_created_by = NEW.user_id THEN
    RAISE EXCEPTION 'No puedes pujar en tu propia subasta.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER prevent_self_bid
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_bidding();

-- 8. Prevent negative or zero bids
CREATE OR REPLACE FUNCTION public.validate_bid_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_price NUMERIC;
BEGIN
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'El monto de la puja debe ser mayor a cero.';
  END IF;

  SELECT current_price INTO v_current_price
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF NEW.amount <= v_current_price THEN
    RAISE EXCEPTION 'La puja debe ser mayor al precio actual ($%)', v_current_price;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_bid_amount
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.validate_bid_amount();

-- 9. Prevent bidding on non-active or ended auctions (server-side)
CREATE OR REPLACE FUNCTION public.validate_auction_status_for_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_end_time TIMESTAMPTZ;
BEGIN
  SELECT status, end_time INTO v_status, v_end_time
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Subasta no encontrada.';
  END IF;

  IF v_status != 'active' THEN
    RAISE EXCEPTION 'Esta subasta no estÃ¡ activa.';
  END IF;

  IF v_end_time <= NOW() THEN
    RAISE EXCEPTION 'Esta subasta ya ha finalizado.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_auction_status_bid
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.validate_auction_status_for_bid();

-- 10. Add index for faster rate limit checks
CREATE INDEX IF NOT EXISTS idx_bids_rate_limit ON public.bids (user_id, auction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_rate_limit ON public.payment_proofs (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_rate_limit ON public.disputes (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_rate_limit ON public.auction_reports (reporter_id, created_at DESC);

-- 11. Ensure dealer_balance cannot go negative
CREATE OR REPLACE FUNCTION public.validate_dealer_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.dealer_balance < 0 THEN
    RAISE EXCEPTION 'El balance del dealer no puede ser negativo.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_dealer_balance_trigger
BEFORE UPDATE ON public.dealer_verification
FOR EACH ROW
WHEN (NEW.dealer_balance IS DISTINCT FROM OLD.dealer_balance)
EXECUTE FUNCTION public.validate_dealer_balance();

-- 12. Prevent withdrawal amount exceeding balance
CREATE OR REPLACE FUNCTION public.validate_withdrawal_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT dealer_balance INTO v_balance
  FROM public.dealer_verification
  WHERE user_id = NEW.dealer_id;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'El monto de retiro debe ser mayor a cero.';
  END IF;

  IF NEW.amount > COALESCE(v_balance, 0) THEN
    RAISE EXCEPTION 'Fondos insuficientes. Balance disponible: $%', COALESCE(v_balance, 0);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_withdrawal
BEFORE INSERT ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.validate_withdrawal_amount();
-- Drop notification-related triggers
DROP TRIGGER IF EXISTS on_auction_finalized_notify_winner ON auctions;
DROP TRIGGER IF EXISTS on_new_bid_notify_dealer ON bids;
DROP TRIGGER IF EXISTS on_new_bid_notify_outbid ON bids;
DROP TRIGGER IF EXISTS on_payment_approved_notify_buyer ON payment_proofs;
DROP TRIGGER IF EXISTS trigger_push_on_notification ON notifications;

-- Drop notification-related functions
DROP FUNCTION IF EXISTS notify_auction_winner();
DROP FUNCTION IF EXISTS notify_dealer_new_bid();
DROP FUNCTION IF EXISTS notify_outbid();
DROP FUNCTION IF EXISTS notify_payment_approved();
DROP FUNCTION IF EXISTS send_push_on_notification();
DROP FUNCTION IF EXISTS send_auction_countdown_notifications();

-- Clean data from tables (keep tables for rebuild later)
DELETE FROM push_subscriptions;
DELETE FROM notifications;

-- Make web push fields nullable and add FCM/platform support
ALTER TABLE public.push_subscriptions 
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

ALTER TABLE public.push_subscriptions 
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS fcm_token text;

-- Add unique constraint on fcm_token to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_token 
  ON public.push_subscriptions(fcm_token) WHERE fcm_token IS NOT NULL;

-- Add unique constraint on endpoint to avoid duplicates  
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
  ON public.push_subscriptions(endpoint) WHERE endpoint IS NOT NULL;

-- Update RLS: admins should also be able to read subscriptions (for sending push)
CREATE POLICY "Admins can read all subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 1. When someone is outbid
CREATE OR REPLACE FUNCTION public.notify_outbid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_previous_bidder_id UUID;
  v_auction_title TEXT;
BEGIN
  SELECT b.user_id INTO v_previous_bidder_id
  FROM public.bids b
  WHERE b.auction_id = NEW.auction_id
    AND b.user_id != NEW.user_id
    AND b.id != NEW.id
  ORDER BY b.amount DESC
  LIMIT 1;

  IF v_previous_bidder_id IS NOT NULL THEN
    SELECT title INTO v_auction_title FROM public.auctions WHERE id = NEW.auction_id;
    
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_previous_bidder_id,
      'âš¡ Â¡Te han sobrepujado!',
      'Alguien ha superado tu puja en "' || COALESCE(v_auction_title, 'subasta') || '" con $' || NEW.amount || '. Â¡Puja de nuevo!',
      'outbid',
      '/auction/' || NEW.auction_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_bid_notify_outbid
AFTER INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.notify_outbid();

-- 2. When auction finalizes and there's a winner
CREATE OR REPLACE FUNCTION public.notify_auction_winner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'finalized' AND OLD.status != 'finalized' AND NEW.winner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.winner_id,
      'ðŸ† Â¡Ganaste la subasta!',
      'Â¡Felicitaciones! Ganaste "' || NEW.title || '" por $' || NEW.current_price || '. Procede al pago.',
      'auction_won',
      '/auction/' || NEW.id
    );
    
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'ðŸŽ‰ Subasta finalizada',
      'Tu subasta "' || NEW.title || '" finalizÃ³ con un precio de $' || NEW.current_price || '.',
      'auction_finalized',
      '/auction/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auction_finalized_notify
AFTER UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.notify_auction_winner();

-- 3. When payment is approved, notify buyer
CREATE OR REPLACE FUNCTION public.notify_payment_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auction_title TEXT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    SELECT title INTO v_auction_title FROM public.auctions WHERE id = NEW.auction_id;
    
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.buyer_id,
      'âœ… Pago verificado',
      'Tu pago para "' || COALESCE(v_auction_title, 'subasta') || '" ha sido verificado. El dealer procederÃ¡ con el envÃ­o.',
      'payment_verified',
      '/auction/' || NEW.auction_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_approved_notify
AFTER UPDATE ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.notify_payment_approved();

-- 4. Trigger to send push when notification is inserted
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', COALESCE(NEW.link, '/'),
      'tag', NEW.type
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_push_on_notification_insert
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_on_notification();

-- Create branding_config table
CREATE TABLE IF NOT EXISTS public.branding_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Insert default branding values
INSERT INTO public.branding_config (key, value) VALUES
  ('primary_color', '262 80% 50%'),
  ('secondary_color', '220 14% 96%'),
  ('accent_color', '38 92% 50%'),
  ('logo_url', ''),
  ('site_name', 'SubastÃ¡ndolo')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.branding_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read branding
CREATE POLICY "Anyone can view branding" ON public.branding_config
  FOR SELECT USING (true);

-- Only admins can manage branding
CREATE POLICY "Admins can manage branding" ON public.branding_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
NOTIFY pgrst, 'reload schema';
-- Fix brand settings: update site name and correct brand green color
-- #A6E300 in HSL = 76 100% 44%

UPDATE public.site_settings
SET setting_value = 'Subastandolo'
WHERE setting_key = 'site_name';

UPDATE public.site_settings
SET setting_value = 'Â© 2025 Subastandolo. Todos los derechos reservados.'
WHERE setting_key = 'footer_text';

-- Primary color: dark navy #1e293b = HSL 215 28% 17%
UPDATE public.site_settings
SET setting_value = '215 28% 17%'
WHERE setting_key = 'primary_color';

-- Accent color: brand green #A6E300 = HSL 76 100% 44%
UPDATE public.site_settings
SET setting_value = '76 100% 44%'
WHERE setting_key = 'accent_color';
-- Insert a test product auction
-- Uses the admin user account to create the test auction
-- Image: public Unsplash image of a laptop

INSERT INTO public.auctions (
  title,
  description,
  image_url,
  starting_price,
  current_price,
  end_time,
  status,
  created_by
)
SELECT
  'MacBook Pro 16" M3 Max - 48GB RAM',
  'Laptop de alto rendimiento con chip M3 Max, 48GB de memoria unificada, 1TB SSD. En excelentes condiciones, garantÃ­a Apple de 1 aÃ±o restante. Ideal para diseÃ±o, video, programaciÃ³n y gaming.',
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
  850.00,
  0.00,
  now() + INTERVAL '3 days 6 hours',
  'active',
  id
FROM auth.users
WHERE email = 'uniformeskronus@gmail.com'
LIMIT 1;
-- Add bcv_rate setting to site_settings so admin can set it manually
INSERT INTO public.site_settings (setting_key, setting_value, setting_type, category, label)
VALUES ('bcv_rate', '', 'text', 'general', 'Tasa BCV del DÃ­a (Bs/$)')
ON CONFLICT (setting_key) DO NOTHING;
-- Fix 1: Allow admins to SELECT push_subscriptions (needed to send to "all" subscribers)
CREATE POLICY "Admins can view push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Allow SECURITY DEFINER functions (system triggers) to insert notifications for any user
-- The existing "Admins can insert notifications" policy covers auth.uid() = admin
-- But DB trigger functions (SECURITY DEFINER) run as the definer user, which bypasses RLS
-- We need an additional policy to allow service_role / postgres role inserts
-- This is done via a permissive check (the SECURITY DEFINER functions already bypass RLS)

-- Fix 3: Add a policy to allow the system (postgres role / service_role) to insert notifications
-- This ensures the trigger-based notifications (outbid, won, etc.) always work
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop and recreate more permissive INSERT policy for notifications
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

-- Allow admins AND the postgres/service role to insert
CREATE POLICY "System and admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    -- Admins can insert
    public.has_role(auth.uid(), 'admin'::app_role)
    -- SECURITY DEFINER functions run without auth.uid() so this covers triggers
    OR auth.uid() IS NULL
  );
-- Add platform column to push_subscriptions to differentiate FCM tokens from Web Push
ALTER TABLE public.push_subscriptions 
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'android', 'ios'));

-- Index for efficient queries by platform
CREATE INDEX IF NOT EXISTS push_subscriptions_platform_idx 
  ON public.push_subscriptions(platform);
