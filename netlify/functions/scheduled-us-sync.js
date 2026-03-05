import { supabase } from './utils/supabaseClient.js';
import { fetchStockData } from './utils/scraper.js';
import { getComputeUniverse } from './utils/universe.js';

/**
 * Scheduled sync for the US Market segment of the Monitors Universe.
 * Designed to run at 6:00 AM MYT to capture the session that just closed in NY.
 */
export const handler = async (event, context) => {
    console.log('Starting Scheduled Sync US Market...');

    try {
        const today = new Date().toISOString().split('T')[0];
        const allStocks = await getComputeUniverse();

        // Filter ONLY US Stocks (market not MYR/KLSE)
        const stocks = allStocks.filter(s => s.market !== 'MYR' && s.market !== 'KLSE');

        if (!stocks || stocks.length === 0) {
            console.log('No US stocks found in universe.');
            return { statusCode: 200, body: 'Empty US universe.' };
        }

        console.log(`Syncing ${stocks.length} US stocks...`);

        // 1. Create Job record
        const { data: newJob, error: createError } = await supabase
            .from('sync_jobs')
            .insert({
                as_of_date: today,
                status: 'running',
                total_tickers: stocks.length,
                processed_count: 0,
                error_message: 'US Market Specific Sync'
            })
            .select()
            .single();

        if (createError) {
            console.error('Failed to create US job:', createError);
            return { statusCode: 500 };
        }

        const jobId = newJob.id;

        // 2. Loop and Scrape
        const BATCH_SIZE = 25;
        let processed = 0;
        let success = 0;
        let failed = 0;

        for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
            const chunk = stocks.slice(i, i + BATCH_SIZE);
            const updates = [];
            const logs = [];

            await Promise.all(chunk.map(async (stock) => {
                try {
                    const data = await fetchStockData(stock.ticker_full);
                    if (data) {
                        updates.push({
                            ticker_full: stock.ticker_full,
                            price_date: data.priceDate,
                            open: data.open,
                            high: data.high,
                            low: data.low,
                            close: data.close,
                            volume: data.volume,
                            source: 'scheduled_scraper_us_early'
                        });
                        success++;
                    } else {
                        failed++;
                        logs.push({ job_id: jobId, ticker_full: stock.ticker_full, status: 'error', message: 'No data returned from US scraper' });
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

            await new Promise(r => setTimeout(r, 250));
        }

        await supabase.from('sync_jobs')
            .update({
                status: 'done',
                finished_at: new Date().toISOString()
            })
            .eq('id', jobId);

        // Optional: Trigger screener calculation for US results separately if needed
        // For now, let it be picked up by the next computeScreener run or user demand.

        return {
            statusCode: 200,
            body: JSON.stringify({ status: 'done', processed, success, failed, market: 'US' })
        };

    } catch (err) {
        console.error('US Scheduled Sync Failed:', err);
        return { statusCode: 500, body: err.message };
    }
};
