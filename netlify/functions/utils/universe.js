import { supabase } from './supabaseClient';

/**
 * Gets the list of tickers that should be synced and computed.
 * This includes all Top 300 stocks PLUS any stock that has ever been favourited.
 */
export async function getComputeUniverse() {
    // 1. Get Top 300 stocks
    const { data: top300 } = await supabase
        .from('klse_stocks')
        .select('ticker_full, ticker_code, company_name, short_name, shariah_status')
        .eq('is_top300', true)
        .eq('is_active', true);

    // 2. Get all stocks from favourites table (even if is_active is false, to "keep warm")
    const { data: favs } = await supabase
        .from('favourites')
        .select('ticker_full');

    const favTickers = favs ? favs.map(f => f.ticker_full) : [];

    // 3. Get detailed info for those favourites if they are not already in top300
    let allStocks = top300 || [];
    const existingTickers = new Set(allStocks.map(s => s.ticker_full));

    const missingTickers = favTickers.filter(t => !existingTickers.has(t));

    if (missingTickers.length > 0) {
        const { data: missingInfo } = await supabase
            .from('klse_stocks')
            .select('ticker_full, ticker_code, company_name, short_name, shariah_status')
            .in('ticker_full', missingTickers);

        if (missingInfo) {
            allStocks = allStocks.concat(missingInfo);
        }
    }

    return allStocks;
}
