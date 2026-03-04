-- Migration: Add OHLC columns to klse_prices_daily
ALTER TABLE public.klse_prices_daily 
ADD COLUMN IF NOT EXISTS open DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS high DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS low DECIMAL(10, 4);
