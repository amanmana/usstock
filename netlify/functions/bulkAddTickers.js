import { supabase } from './utils/supabaseClient.js';
import axios from 'axios';

/**
 * Bulk add tickers to the screener as SHARIAH-compliant counters.
 * For each ticker: validate via Yahoo → upsert to klse_stocks → fetch history
 */
export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const { tickers } = JSON.parse(event.body);
        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing tickers array' }) };
        }

        const results = { added: [], skipped: [], errors: [] };

        for (const rawTicker of tickers) {
            const ticker = rawTicker.trim().toUpperCase();
            if (!ticker) continue;

            try {
                // 1. Check if already exists and active
                const { data: existing } = await supabase
                    .from('klse_stocks')
                    .select('ticker_full, is_active, shariah_status')
                    .eq('ticker_full', ticker)
                    .maybeSingle();

                if (existing?.is_active && existing?.shariah_status === 'SHARIAH') {
                    results.skipped.push(ticker);
                    continue;
                }

                // 2. Validate ticker via Yahoo Finance
                let companyName = ticker;
                try {
                    const quoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
                    const { data: yData } = await axios.get(quoteUrl, { timeout: 8000 });
                    const meta = yData?.chart?.result?.[0]?.meta;
                    if (meta?.longName || meta?.shortName) {
                        companyName = meta.longName || meta.shortName;
                    }
                } catch (e) {
                    // Yahoo validation failed, use ticker as name
                }

                // 3. Upsert to klse_stocks as SHARIAH
                await supabase.from('klse_stocks').upsert({
                    ticker_full: ticker,
                    ticker_code: ticker,
                    company_name: companyName,
                    short_name: ticker,
                    market: 'US',
                    shariah_status: 'SHARIAH',
                    is_active: true,
                    is_top300: false,
                    source_origin: 'manual_shariah_import'
                }, { onConflict: 'ticker_full' });

                // 4. Import price history if needed
                const { count } = await supabase
                    .from('klse_prices_daily')
                    .select('*', { count: 'exact', head: true })
                    .eq('ticker_full', ticker);

                if (!count || count < 10) {
                    try {
                        const histUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1d`;
                        const { data: hData } = await axios.get(histUrl, { timeout: 10000 });
                        if (hData?.chart?.result?.[0]) {
                            const result = hData.chart.result[0];
                            const timestamps = result.timestamp || [];
                            const quotes = result.indicators.quote[0];
                            const updates = [];
                            for (let i = 0; i < timestamps.length; i++) {
                                const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                                if (quotes.close[i] != null) {
                                    updates.push({
                                        ticker_full: ticker,
                                        price_date: date,
                                        close: parseFloat(quotes.close[i].toFixed(3)),
                                        open: quotes.open?.[i] ? parseFloat(quotes.open[i].toFixed(3)) : null,
                                        high: quotes.high?.[i] ? parseFloat(quotes.high[i].toFixed(3)) : null,
                                        low: quotes.low?.[i] ? parseFloat(quotes.low[i].toFixed(3)) : null,
                                        volume: parseInt(quotes.volume?.[i] || 0),
                                        source: 'bulk_shariah_import'
                                    });
                                }
                            }
                            if (updates.length > 0) {
                                await supabase.from('klse_prices_daily').upsert(updates, { onConflict: 'ticker_full, price_date' });
                            }
                        }
                    } catch (e) {
                        console.error(`History import failed for ${ticker}:`, e.message);
                    }
                }

                results.added.push({ ticker, name: companyName });
            } catch (e) {
                results.errors.push({ ticker, error: e.message });
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, ...results })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
