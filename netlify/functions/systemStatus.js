import { supabase } from './utils/supabaseClient.js';

export const handler = async (event, context) => {
    // Helper to get Data Maturity & Last Sync info
    try {
        // 1. Calculate maturity. Instead of just Maybank, let's see how many dates we have
        // where we have prices for a significant number of stocks (e.g. at least 50).
        // This ensures the maturity reflects market-wide data, not just 1-2 imported stocks.

        const { data: dayCounts, error: countError } = await supabase
            .rpc('get_market_data_maturity'); // We'll create this RPC

        let totalDays = 0;
        let realDays = 0;

        if (!countError && dayCounts && dayCounts.length > 0) {
            const stats = dayCounts[0];
            realDays = stats.real_days_count || 0;
            totalDays = stats.total_days_count || 0;
        } else {
            // Fallback to proxy if RPC fails
            const PROXY_TICKER = 'AAPL';
            const { data: days } = await supabase
                .from('klse_prices_daily')
                .select('price_date, source')
                .eq('ticker_full', PROXY_TICKER);

            if (days) {
                realDays = new Set(days.filter(d => ['scraper_live', 'yahoo_live', 'yahoo_history_import'].includes(d.source)).map(d => d.price_date)).size;
                totalDays = new Set(days.map(d => d.price_date)).size;
            }
        }

        // 2. Get Last Successful Sync Job
        const { data: lastJob } = await supabase
            .from('sync_jobs')
            .select('*')
            .eq('status', 'done')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        return {
            statusCode: 200,
            body: JSON.stringify({
                dataMaturity: {
                    totalDays,
                    realDays,
                    daysToMA20: Math.max(0, 20 - realDays),
                    daysToMA50: Math.max(0, 50 - realDays),
                    progressMA20: Math.min(100, Math.round((totalDays / 20) * 100)),
                    progressMA50: Math.min(100, Math.round((totalDays / 50) * 100)),
                    realProgressMA20: Math.min(100, Math.round((realDays / 20) * 100)),
                    realProgressMA50: Math.min(100, Math.round((realDays / 50) * 100))
                },
                lastSync: lastJob ? {
                    date: lastJob.created_at,
                    finishedAt: lastJob.finished_at,
                    count: lastJob.processed_count
                } : null
            })
        };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
