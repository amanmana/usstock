import { supabase } from './utils/supabaseClient.js';
import { fetchStockData } from './utils/scraper.js';
import { getComputeUniverse } from './utils/universe.js';

/**
 * Scheduled sync for the entire monitored universe (Top 300 + Favourites).
 */
export const handler = async (event, context) => {
    console.log('Starting Scheduled Sync Universe...');

    try {
        const today = new Date().toISOString().split('T')[0];
        const allStocks = await getComputeUniverse();

        // Filter ONLY Bursa Stocks (market is MYR or KLSE)
        const stocks = allStocks.filter(s => s.market === 'MYR' || s.market === 'KLSE');

        if (!stocks || stocks.length === 0) return { statusCode: 200, body: 'Empty Bursa universe.' };

        // 1. Create Job
        const { data: newJob, error: createError } = await supabase
            .from('sync_jobs')
            .insert({
                as_of_date: today,
                status: 'running',
                total_tickers: stocks.length,
                processed_count: 0
            })
            .select()
            .single();

        if (createError) {
            console.error('Failed to create job:', createError);
            return { statusCode: 500 };
        }

        const jobId = newJob.id;

        // 2. Loop and Scrape
        const BATCH_SIZE = 25; // Increased from 10
        let processed = 0;
        let success = 0;
        let failed = 0;

        for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
            const chunk = stocks.slice(i, i + BATCH_SIZE);
            const updates = [];
            const logs = [];

            await Promise.all(chunk.map(async (stock) => {
                try {
                    let yfSymbol = stock.ticker_full;
                    if ((stock.market === 'MYR' || stock.market === 'KLSE') && stock.ticker_code) {
                        yfSymbol = stock.ticker_code.endsWith('.KL') ? stock.ticker_code : `${stock.ticker_code}.KL`;
                    }
                    const data = await fetchStockData(yfSymbol);
                    if (data) {
                        updates.push({
                            ticker_full: stock.ticker_full,
                            price_date: data.priceDate,
                            open: data.open,
                            high: data.high,
                            low: data.low,
                            close: data.close,
                            volume: data.volume,
                            source: 'scheduled_scraper_live'
                        });
                        success++;
                    } else {
                        failed++;
                        logs.push({ job_id: jobId, ticker_full: stock.ticker_full, status: 'error', message: 'No data returned from scraper' });
                    }
                } catch (e) {
                    failed++;
                    logs.push({ job_id: jobId, ticker_full: stock.ticker_full, status: 'error', message: e.message });
                }
            }));

            if (updates.length > 0) {
                await supabase.from('klse_prices_daily').upsert(updates, { onConflict: 'ticker_full, price_date' });
            }
            if (logs.length > 0) {
                await supabase.from('sync_logs').insert(logs);
            }

            processed += chunk.length;

            await supabase.from('sync_jobs').update({
                processed_count: processed,
                success_count: success,
                failed_count: failed
            }).eq('id', jobId);

            // Minimal delay to prevent burst limits but stay under timeout
            await new Promise(r => setTimeout(r, 250)); // Reduced from 1000
        }

        await supabase.from('sync_jobs')
            .update({
                status: 'done',
                finished_at: new Date().toISOString()
            })
            .eq('id', jobId);

        // TRIGGER COMPUTE SCREENER FOR BURSA
        try {
            console.log('Triggering Screener Computation for Bursa...');
            await fetch('https://us-stock-screener-amanmana.netlify.app/.netlify/functions/computeScreener?market=MYR');
        } catch (e) {
            console.error('Failed to trigger computeScreener:', e.message);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ status: 'done', processed, success, failed })
        };

    } catch (err) {
        console.error('Scheduled Sync Failed:', err);
        // Important: Update job status so dashboard doesn't stay in "running" forever
        try {
            await supabase.from('sync_jobs')
                .update({
                    status: 'error',
                    error_message: err.message,
                    finished_at: new Date().toISOString()
                })
                .filter('status', 'eq', 'running'); // Best effort to catch current job
        } catch (updateErr) {
            console.error('Could not update job status to error:', updateErr);
        }

        return { statusCode: 500, body: err.message };
    }
};
