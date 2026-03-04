-- Migration: Create missing tables (favourites & trading_positions)

-- 1) favourites
CREATE TABLE IF NOT EXISTS public.favourites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker_full TEXT NOT NULL REFERENCES public.klse_stocks(ticker_full) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    alert_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ticker_full)
);

CREATE INDEX IF NOT EXISTS idx_favourites_ticker ON public.favourites(ticker_full);

-- RLS for favourites
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on favourites" ON public.favourites FOR SELECT USING (true);


-- 2) trading_positions
CREATE TABLE IF NOT EXISTS public.trading_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker_full TEXT NOT NULL REFERENCES public.klse_stocks(ticker_full) ON DELETE CASCADE,
    entry_price DECIMAL(10, 4) NOT NULL,
    strategy TEXT,
    quantity INTEGER NOT NULL,
    stop_loss DECIMAL(10, 4),
    target_price DECIMAL(10, 4),
    max_risk DECIMAL(10, 2),
    buy_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ticker_full)
);

CREATE INDEX IF NOT EXISTS idx_trading_positions_ticker ON public.trading_positions(ticker_full);

-- RLS for trading_positions
ALTER TABLE public.trading_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on trading_positions" ON public.trading_positions FOR SELECT USING (true);
