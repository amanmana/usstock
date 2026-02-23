import { supabase } from './utils/supabaseClient.js';
import axios from 'axios';

/**
 * Manually adds a ticker to favourites.
 * If ticker is not in master list, it creates it as a 'custom' origin ticker
 * AND fetches initial history so signals are ready.
 */
export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const { symbol, name } = JSON.parse(event.body);
        if (!symbol) return { statusCode: 400, body: 'Missing symbol' };

        // 1. Resolve Ticker (Numeric if possible)
        let ticker = symbol.toUpperCase().trim();

        // Search in master list first by code, short name, or name
        const { data: matchedStock } = await supabase
            .from('klse_stocks')
            .select('*')
            .or(`ticker_code.eq."${ticker}",short_name.eq."${ticker}",company_name.ilike."%${ticker}%",ticker_full.ilike."${ticker}%"`)
            .maybeSingle();

        if (matchedStock) {
            ticker = matchedStock.ticker_full;
        }

        const tickerCode = ticker.split('.')[0];

        // Ensure exists in klse_stocks and has history
        const { data: existingStock } = await supabase
            .from('klse_stocks')
            .select('*')
            .eq('ticker_full', ticker)
            .maybeSingle();

        if (!existingStock) {
            await supabase.from('klse_stocks').insert({
                ticker_full: ticker,
                ticker_code: tickerCode,
                company_name: name || tickerCode,
                is_top300: false,
                source_origin: 'custom',
                is_active: true
            });
        }

        // --- NEW: Check if history exists for this ticker ---
        const { count } = await supabase
            .from('klse_prices_daily')
            .select('*', { count: 'exact', head: true })
            .eq('ticker_full', ticker);

        // If less than 10 days of history, fetch from Yahoo
        if (!count || count < 10) {
            console.log(`Fetching history for ${ticker} (Count: ${count})...`);
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=6mo&interval=1d`;
                const { data: yData } = await axios.get(url, { timeout: 10000 });
                if (yData.chart?.result?.[0]) {
                    const result = yData.chart.result[0];
                    const timestamps = result.timestamp;
                    const quotes = result.indicators.quote[0];
                    const updates = [];
                    for (let i = 0; i < (timestamps?.length || 0); i++) {
                        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                        if (quotes.close[i] != null) {
                            updates.push({
                                ticker_full: ticker,
                                price_date: date,
                                close: parseFloat(quotes.close[i].toFixed(3)),
                                volume: parseInt(quotes.volume[i] || 0),
                                source: 'yahoo_history_import'
                            });
                        }
                    }
                    if (updates.length > 0) {
                        await supabase.from('klse_prices_daily').upsert(updates, { onConflict: 'ticker_full, price_date' });
                    }
                }
            } catch (e) {
                console.error("Historical import failed for ticker:", ticker, e.message);
            }
        }

        // 2. Add/Activate in Favourites
        const { data: existingFav } = await supabase
            .from('favourites')
            .select('*')
            .eq('ticker_full', ticker)
            .maybeSingle();

        if (existingFav) {
            await supabase.from('favourites').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', existingFav.id);
        } else {
            await supabase.from('favourites').insert({ ticker_full: ticker, is_active: true });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, ticker })
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
