-- Migration: Create trade_history table
CREATE TABLE IF NOT EXISTS public.trade_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker_full TEXT NOT NULL REFERENCES public.klse_stocks(ticker_full) ON DELETE CASCADE,
    entry_price DECIMAL(10, 4) NOT NULL,
    sell_price DECIMAL(10, 4) NOT NULL,
    quantity INTEGER NOT NULL,
    strategy TEXT, -- "rebound", "momentum"
    trade_type TEXT DEFAULT 'REAL', -- "REAL", "PAPER"
    buy_date TIMESTAMPTZ,
    sell_date TIMESTAMPTZ DEFAULT NOW(),
    pnl_amount DECIMAL(15, 2),
    pnl_percent DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_trade_history_ticker ON public.trade_history(ticker_full);
CREATE INDEX IF NOT EXISTS idx_trade_history_sell_date ON public.trade_history(sell_date DESC);
CREATE INDEX IF NOT EXISTS idx_trade_history_type ON public.trade_history(trade_type);

-- RLS
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on trade_history" ON public.trade_history FOR SELECT USING (true);
