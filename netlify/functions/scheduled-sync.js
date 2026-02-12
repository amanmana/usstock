import { supabase } from './utils/supabaseClient';
import { fetchStockData } from './utils/scraper';
import { getComputeUniverse } from './utils/universe';

/**
 * Scheduled sync for the entire monitored universe (Top 300 + Favourites).
 */
export const handler = async (event, context) => {
    console.log('Starting Scheduled Sync Universe...');

    try {
        const today = new Date().toISOString().split('T')[0];
        const stocks = await getComputeUniverse();
        if (!stocks || stocks.length === 0) return { statusCode: 200, body: 'Empty universe.' };

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
        const BATCH_SIZE = 10;
        let processed = 0;
        let success = 0;
        let failed = 0;

        for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
            const chunk = stocks.slice(i, i + BATCH_SIZE);
            const updates = [];
            const logs = [];

            await Promise.all(chunk.map(async (stock) => {
                try {
                    const data = await fetchStockData(stock.ticker_code);
                    if (data) {
                        updates.push({
                            ticker_full: stock.ticker_full,
                            price_date: data.priceDate,
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

            await new Promise(r => setTimeout(r, 1000));
        }

        await supabase.from('sync_jobs').update({ status: 'done', finished_at: new Date().toISOString() }).eq('id', jobId);

        return {
            statusCode: 200,
            body: JSON.stringify({ status: 'done', processed, success, failed })
        };

    } catch (err) {
        console.error('Scheduled Sync Failed:', err);
        return { statusCode: 500, body: err.message };
    }
};
