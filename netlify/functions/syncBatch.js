import { supabase } from './utils/supabaseClient.js';
import { fetchStockData } from './utils/scraper.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Make sure to call this via POST with "jobId" and "offset".' };
    }

    const { jobId, offset, limit = 25 } = JSON.parse(event.body);

    if (!jobId || offset === undefined) {
        return { statusCode: 400, body: 'Missing jobId or offset' };
    }

    try {
        // 1. Fetch batch of stocks to process
        const { data: stocks, error: fetchError } = await supabase
            .from('klse_stocks')
            .select('ticker_full, ticker_code, market')
            .eq('is_active', true)
            .range(offset, offset + limit - 1);

        if (fetchError) throw fetchError;

        if (!stocks || stocks.length === 0) {
            // No more stocks, maybe update job status to 'processing_complete' or let client decide
            return {
                statusCode: 200,
                body: JSON.stringify({ status: 'complete', message: 'No more stocks to sync.' })
            };
        }

        // 2. Process each stock (parallel with limit or sequential)
        // Using Promise.all for speed, assuming 25 is small enough for Netlify 10s timeout if scraper is fast.
        // Real scraping might take 1s each -> 25s which is > 10s default timeout.
        // I'll limit concurrency to 5 at a time.

        const results = [];
        const updates = [];
        const logs = [];

        // Chunk into 5s
        const chunkSize = 5;
        for (let i = 0; i < stocks.length; i += chunkSize) {
            const chunk = stocks.slice(i, i + chunkSize);

            const chunkPromises = chunk.map(async (stock) => {
                try {
                    let yfSymbol = stock.ticker_full;
                    if ((stock.market === 'MYR' || stock.market === 'KLSE') && stock.ticker_code) {
                        yfSymbol = stock.ticker_code.endsWith('.KL') ? stock.ticker_code : `${stock.ticker_code}.KL`;
                    }

                    const data = await fetchStockData(yfSymbol);
                    // const data = await mockStockData(stock.ticker_code); // Disabled Mock

                    if (data) {
                        updates.push({
                            ticker_full: stock.ticker_full,
                            price_date: data.priceDate,
                            open: data.open,
                            high: data.high,
                            low: data.low,
                            close: data.close,
                            volume: data.volume,
                            source: 'yahoo_live'
                        });
                        return { ticker: stock.ticker_full, status: 'success' };
                    } else {
                        return { ticker: stock.ticker_full, status: 'failed', reason: 'No data' };
                    }
                } catch (err) {
                    return { ticker: stock.ticker_full, status: 'failed', reason: err.message };
                }
            });

            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }

        // 3. Bulk Upsert Prices
        if (updates.length > 0) {
            const { error: upsertError } = await supabase
                .from('klse_prices_daily')
                .upsert(updates, { onConflict: 'ticker_full, price_date' });

            if (upsertError) console.error('Upsert errored:', upsertError);
        }

        // 4. Update Job Progress
        // We increment processed_count. Using generic update for simplicity.
        // In a real high-concurrency scenario, use stored procedure or atomic Increment.
        // Here we just fetch current job, update count.

        const successCount = results.filter(r => r.status === 'success').length;
        const failedCount = results.filter(r => r.status === 'failed').length;

        // Log failures
        const failures = results.filter(r => r.status === 'failed').map(r => ({
            job_id: jobId,
            ticker_full: r.ticker,
            status: 'error',
            message: r.reason
        }));

        if (failures.length > 0) {
            await supabase.from('sync_logs').insert(failures);
        }

        // Update job counters (atomic preferred, but simple update here)
        // We can't easily do atomic increment with simple Supabase JS client without RPC.
        // So we'll validly read-modify-write or just let the client track progress via status.
        // But syncStatus needs to see it.

        // Let's use an RPC if available, or just read-update.
        const { data: currentJob } = await supabase.from('sync_jobs').select('*').eq('id', jobId).single();
        if (currentJob) {
            await supabase.from('sync_jobs').update({
                processed_count: (currentJob.processed_count || 0) + stocks.length,
                success_count: (currentJob.success_count || 0) + successCount,
                failed_count: (currentJob.failed_count || 0) + failedCount,
                status: 'running'
            }).eq('id', jobId);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'ok',
                processed: stocks.length,
                results
            }),
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
