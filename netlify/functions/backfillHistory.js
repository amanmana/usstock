import { supabase } from './utils/supabaseClient';
import axios from 'axios';

/**
 * Netlify Function to backfill 6 months of historical data for the Top 300 stocks.
 * Can be triggered manually or via a scheduled task.
 */
export const handler = async (event, context) => {
    try {
        // 1. Get Top 300 stocks
        const { data: stocks, error: fetchError } = await supabase
            .from('klse_stocks')
            .select('ticker_full, ticker_code')
            .eq('is_top300', true)
            .eq('is_active', true);

        if (fetchError) throw fetchError;
        if (!stocks || stocks.length === 0) {
            return { statusCode: 200, body: 'No stocks to backfill' };
        }

        const stats = { total: stocks.length, success: 0, failed: 0 };
        const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

        // Process in small batches to avoid timeouts
        // Note: For a full 300 stocks, this might need multiple runs or a longer timeout
        for (const stock of stocks) {
            try {
                const symbol = stock.ticker_full;
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`;

                const { data: yData } = await axios.get(url, {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 5000
                });

                if (yData.chart?.result?.[0]) {
                    const result = yData.chart.result[0];
                    const timestamps = result.timestamp;
                    const quotes = result.indicators.quote[0];
                    const updates = [];

                    for (let i = 0; i < (timestamps?.length || 0); i++) {
                        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                        if (quotes.close[i] != null) {
                            updates.push({
                                ticker_full: symbol,
                                price_date: date,
                                close: parseFloat(quotes.close[i].toFixed(3)),
                                volume: parseInt(quotes.volume[i] || 0),
                                source: 'yahoo_history_import'
                            });
                        }
                    }

                    if (updates.length > 0) {
                        const { error: upsertError } = await supabase
                            .from('klse_prices_daily')
                            .upsert(updates, { onConflict: 'ticker_full, price_date' });

                        if (upsertError) throw upsertError;
                        stats.success++;
                    }
                }
            } catch (err) {
                console.error(`Backfill failed for ${stock.ticker_full}:`, err.message);
                stats.failed++;
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Backfill complete', stats })
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
