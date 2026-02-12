import { supabase } from './utils/supabaseClient';
import axios from 'axios';

export const handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

    try {
        const body = JSON.parse(event.body);
        const { ticker, name } = body; // e.g. ticker="2429", name="TANCO"

        if (!ticker || !name) return { statusCode: 400, body: 'Missing ticker or name' };

        const tickerFull = `${ticker}.KL`;
        console.log(`Importing history for ${tickerFull} (${name})...`);

        // 1. Ensure Stock Exists in DB
        const { error: stockError } = await supabase
            .from('klse_stocks')
            .upsert({
                ticker_full: tickerFull,
                ticker_code: ticker,
                company_name: name,
                shariah_status: 'UNKNOWN', // Default
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

            const close = quotes.close[i];
            const volume = quotes.volume[i];

            if (close != null && volume != null) {
                updates.push({
                    ticker_full: tickerFull,
                    price_date: dateStr,
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
