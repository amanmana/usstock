import { supabase } from './utils/supabaseClient.js';
import axios from 'axios';

export const handler = async (event, context) => {
    // Allow POST and GET for ease of manual backfill
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'POST or GET required' };
    }

    try {
        let ticker, name;

        if (event.body) {
            const body = JSON.parse(event.body);
            ticker = body.ticker;
            name = body.name;
        } else {
            ticker = event.queryStringParameters?.ticker;
            name = event.queryStringParameters?.name || ticker;
        }

        if (!ticker) return { statusCode: 400, body: JSON.stringify({ error: 'Missing ticker' }) };

        const tickerFull = ticker; // US Stocks don't need a suffix for primary exchanges
        console.log(`Importing history for ${tickerFull} (${name})...`);

        // 1. Ensure Stock Exists in DB
        const { error: stockError } = await supabase
            .from('klse_stocks')
            .upsert({
                ticker_full: tickerFull,
                ticker_code: tickerFull,
                company_name: name,
                shariah_status: 'SHARIAH', // This function is used to backfill Shariah stocks
                is_active: true
            }, { onConflict: 'ticker_full' });

        if (stockError) throw stockError;

        // 2. Fetch History from Yahoo Finance (Hidden API)
        // Range: 3 months (approx 60 trading days) to cover MA20 and MA50
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${tickerFull}?range=6mo&interval=1d`;

        const { data: yData } = await axios.get(url);

        if (!yData.chart || !yData.chart.result || yData.chart.result.length === 0) {
            return { statusCode: 404, body: `No data found on Yahoo for ${tickerFull}` };
        }

        const result = yData.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];

        if (!timestamps || !quotes) return { statusCode: 404, body: 'Invalid Yahoo data structure' };

        const updates = [];

        for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000);
            const dateStr = date.toISOString().split('T')[0];

            const open = quotes.open[i];
            const high = quotes.high[i];
            const low = quotes.low[i];
            const close = quotes.close[i];
            const volume = quotes.volume[i];

            if (close != null && volume != null) {
                updates.push({
                    ticker_full: tickerFull,
                    price_date: dateStr,
                    open: open != null ? parseFloat(open.toFixed(3)) : null,
                    high: high != null ? parseFloat(high.toFixed(3)) : null,
                    low: low != null ? parseFloat(low.toFixed(3)) : null,
                    close: parseFloat(close.toFixed(3)),
                    volume: parseInt(volume),
                    source: 'yahoo_history_import'
                });
            }
        }

        console.log(`Found ${updates.length} historical data points.`);

        // 3. Upsert Prices
        if (updates.length > 0) {
            // Chunking just in case
            const CHUNK_SIZE = 500;
            for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
                const chunk = updates.slice(i, i + CHUNK_SIZE);
                const { error: upsertError } = await supabase
                    .from('klse_prices_daily')
                    .upsert(chunk, { onConflict: 'ticker_full, price_date' });

                if (upsertError) throw upsertError;
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Successfully imported ${updates.length} days of history for ${name}.`,
                count: updates.length
            })
        };

    } catch (err) {
        console.error(err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
