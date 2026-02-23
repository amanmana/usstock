import { supabase } from './utils/supabaseClient.js';
import axios from 'axios';
import { analyzeStock } from './utils/indicators.js';
import { getComputeUniverse } from './utils/universe.js';

/**
 * Netlify Function to backfill historical data for all active stocks.
 * This is crucial for new setups to ensure technical indicators can be calculated.
 */
export const handler = async (event, context) => {
    try {
        const offset = parseInt(event.queryStringParameters?.offset || '0');
        const batchSize = 50;

        // 1. Get all active stocks
        const { data: stocks, error: fetchError } = await supabase
            .from('klse_stocks')
            .select('ticker_full, ticker_code')
            .eq('is_active', true);

        if (fetchError) throw fetchError;
        if (!stocks || stocks.length === 0) {
            return { statusCode: 200, body: 'No stocks to backfill' };
        }

        const stats = { total: stocks.length, success: 0, failed: 0, skipped: 0 };
        const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

        // Process batch based on offset
        const batch = stocks.slice(offset, offset + batchSize);

        for (const stock of batch) {
            try {
                // Check if history already exists (quick check)
                const { count } = await supabase
                    .from('klse_prices_daily')
                    .select('*', { count: 'exact', head: true })
                    .eq('ticker_full', stock.ticker_full);

                if (count > 20) {
                    stats.skipped++;
                    continue; // Already has history
                }

                const symbol = stock.ticker_full;
                // Fetch 1 year of history for better indicators
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`;

                const { data: yData } = await axios.get(url, {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 5000
                });

                if (yData.chart?.result?.[0]) {
                    const result = yData.chart.result[0];
                    const timestamps = result.timestamp;
                    const quotes = result.indicators.quote[0];
                    const updates = [];

                    if (!timestamps) {
                        stats.failed++;
                        continue;
                    }

                    for (let i = 0; i < timestamps.length; i++) {
                        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                        if (quotes.close[i] != null) {
                            updates.push({
                                ticker_full: symbol,
                                price_date: date,
                                open: quotes.open[i] != null ? parseFloat(quotes.open[i].toFixed(3)) : null,
                                high: quotes.high[i] != null ? parseFloat(quotes.high[i].toFixed(3)) : null,
                                low: quotes.low[i] != null ? parseFloat(quotes.low[i].toFixed(3)) : null,
                                close: parseFloat(quotes.close[i].toFixed(3)),
                                volume: parseInt(quotes.volume[i] || 0),
                                source: 'yahoo_history_import'
                            });
                        }
                    }

                    if (updates.length > 0) {
                        // Chunk updates to avoid large payload errors
                        const chunkSize = 100;
                        for (let j = 0; j < updates.length; j += chunkSize) {
                            const { error: upsertError } = await supabase
                                .from('klse_prices_daily')
                                .upsert(updates.slice(j, j + chunkSize), {
                                    onConflict: 'ticker_full, price_date'
                                });
                            if (upsertError) throw upsertError;
                        }
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
            body: JSON.stringify({
                message: 'Backfill batch complete',
                stats: {
                    ...stats,
                    batchSize: batch.length,
                    remaining: stocks.length - batch.length
                }
            })
        };
    } catch (err) {
        console.error('Backfill Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
