-- Add condition column to auctions table
-- Values: 'nuevo', 'usado_buen_estado', 'para_reparar'
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS condition text DEFAULT 'nuevo'
  CHECK (condition IN ('nuevo', 'usado_buen_estado', 'para_reparar'));
