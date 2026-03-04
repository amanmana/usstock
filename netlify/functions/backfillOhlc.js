import { supabase } from './utils/supabaseClient.js';
import axios from 'axios';

/**
 * Netlify Function to backfill missing Open/High/Low data in klse_prices_daily.
 * 
 * POST /.netlify/functions/backfillOhlc
 * Body: { tickers?: string[], limit?: number }
 */
export const handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const limit = body.limit || 10; // Default to 10 tickers to avoid timeout (10s limit)
        let tickerList = body.tickers || [];

        // 1. If no tickers provided, find tickers with missing OHL data
        if (tickerList.length === 0) {
            console.log("Searching for tickers with missing OHLC data...");
            const { data, error: queryError } = await supabase
                .from('klse_prices_daily')
                .select('ticker_full')
                .or('open.is.null,high.is.null,low.is.null')
                .limit(200); // Sample larger pool to find distinct tickers

            if (queryError) throw queryError;

            // Get unique tickers
            const distinctTickers = [...new Set(data.map(item => item.ticker_full))];
            tickerList = distinctTickers.slice(0, limit);
        }

        if (tickerList.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'No tickers found with missing OHLC data.' })
            };
        }

        console.log(`Processing backfill for ${tickerList.length} tickers: ${tickerList.join(', ')}`);

        const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        let totalUpdatedRows = 0;
        const results = [];

        // 2. Process each ticker
        for (const symbol of tickerList) {
            try {
                // Fetch 6 months of history
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`;

                const { data: yData } = await axios.get(url, {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 5000
                });

                if (yData.chart?.result?.[0]) {
                    const result = yData.chart.result[0];
                    const timestamps = result.timestamp;
                    const quotes = result.indicators.quote[0];
                    const adjQuotes = result.indicators.adjclose?.[0];
                    const updates = [];

                    if (!timestamps || !quotes) {
                        results.push({ ticker: symbol, status: 'error', reason: 'No chart data' });
                        continue;
                    }

                    for (let i = 0; i < timestamps.length; i++) {
                        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];

                        // We only update if we have at least close price
                        if (quotes.close[i] != null) {
                            updates.push({
                                ticker_full: symbol,
                                price_date: date,
                                open: quotes.open[i] != null ? parseFloat(quotes.open[i].toFixed(3)) : null,
                                high: quotes.high[i] != null ? parseFloat(quotes.high[i].toFixed(3)) : null,
                                low: quotes.low[i] != null ? parseFloat(quotes.low[i].toFixed(3)) : null,
                                close: parseFloat(quotes.close[i].toFixed(3)),
                                volume: parseInt(quotes.volume[i] || 0),
                                source: 'yahoo_backfill'
                            });
                        }
                    }

                    if (updates.length > 0) {
                        // Bulk upsert by (ticker_full, price_date)
                        const { error: upsertError } = await supabase
                            .from('klse_prices_daily')
                            .upsert(updates, { onConflict: 'ticker_full, price_date' });

                        if (upsertError) throw upsertError;

                        totalUpdatedRows += updates.length;
                        results.push({ ticker: symbol, status: 'success', rows: updates.length });
                    } else {
                        results.push({ ticker: symbol, status: 'skipped', reason: 'No updateable rows' });
                    }
                } else {
                    results.push({ ticker: symbol, status: 'error', reason: 'Invalid Yahoo Response' });
                }
            } catch (err) {
                console.error(`Backfill failed for ${symbol}:`, err.message);
                results.push({ ticker: symbol, status: 'failed', reason: err.message });
            }
        }

        const summary = {
            tickers_processed: results.length,
            total_rows_updated: totalUpdatedRows,
            details: results
        };

        console.log("Backfill Summary:", JSON.stringify(summary));

        return {
            statusCode: 200,
            body: JSON.stringify(summary)
        };

    } catch (err) {
        console.error('Backfill Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
