const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function backfillTop300() {
    console.log("Fetching Top 300 Bursa stocks...");
    const { data: stocks, error: fetchError } = await supabase
        .from('klse_stocks')
        .select('ticker_full, ticker_code, short_name')
        .eq('market', 'MYR')
        .eq('is_top300', true)
        .eq('is_active', true);

    if (fetchError) {
        console.error("Fetch error:", fetchError);
        return;
    }

    console.log(`Found ${stocks.length} Top 300 stocks to backfill.`);

    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    let success = 0;
    let failed = 0;

    for (const stock of stocks) {
        try {
            const symbol = stock.ticker_full;
            const yfSymbol = `${stock.ticker_code}.KL`;
            console.log(`Fetching 1y history for ${yfSymbol} (DB: ${symbol})...`);
            const url = `https://query2.finance.yahoo.com/v8/finance/chart/${yfSymbol}?range=1y&interval=1d`;

            const yRes = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 10000 });

            if (yRes.data?.chart?.result?.[0]) {
                const result = yRes.data.chart.result[0];
                const timestamps = result.timestamp;
                const quotes = result.indicators.quote[0];

                if (!timestamps) {
                    console.log(`No timestamps for ${symbol}`);
                    failed++;
                    continue;
                }

                const updates = [];
                for (let i = 0; i < timestamps.length; i++) {
                    if (quotes.close[i] != null) {
                        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
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
                    const chunkSize = 200;
                    for (let j = 0; j < updates.length; j += chunkSize) {
                        const { error: upsertError } = await supabase
                            .from('klse_prices_daily')
                            .upsert(updates.slice(j, j + chunkSize), { onConflict: 'ticker_full, price_date' });
                        if (upsertError) throw upsertError;
                    }
                    console.log(`Inserted ${updates.length} rows for ${symbol} ✅`);
                    success++;
                } else {
                    failed++;
                }
            } else {
                failed++;
            }

            // Sleep a bit to prevent rate limiting
            await new Promise(res => setTimeout(res, 250));

        } catch (err) {
            console.error(`Failed ${stock.ticker_full}:`, err.response?.status || err.message);
            failed++;
        }
    }

    console.log(`\nDONE! Success: ${success}, Failed: ${failed}`);
}

backfillTop300();
