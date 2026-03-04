-- Migration: Add granular alert settings to favourites table
ALTER TABLE public.favourites 
ADD COLUMN IF NOT EXISTS alert_go BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS alert_tp BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS alert_sl BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_tp_price DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS last_sl_price DECIMAL(10, 4);

-- Sync existing alert_enabled to alert_go for backward compatibility
UPDATE public.favourites SET alert_go = alert_enabled WHERE alert_enabled IS NOT NULL;
