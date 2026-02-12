import { supabase } from './utils/supabaseClient';
import { analyzeStock } from './utils/indicators';
import { getComputeUniverse } from './utils/universe';

/**
 * Computes signals for the entire monitored universe (Top 300 + Favourites).
 * Stores results in cache, tagged with metadata to allow UI filtering.
 */
export const handler = async (event, context) => {
    const useMock = event.queryStringParameters?.useMock !== 'false';
    const mode = useMock ? 'hybrid' : 'real';
    const cacheKey = `universe_all_${mode}`;

    try {
        // 1. Get Universe (Top 300 + Favourites)
        const stocks = await getComputeUniverse();
        if (!stocks || stocks.length === 0) return { statusCode: 200, body: 'No stocks found in universe.' };

        // 2. Fetch Top 300 IDs to tag them
        const { data: top300Data } = await supabase.from('klse_stocks').select('ticker_full').eq('is_top300', true);
        const top300Set = new Set(top300Data?.map(s => s.ticker_full) || []);

        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 365);

        const results = [];

        // 3. Loop and Analyze
        for (const stock of stocks) {
            let query = supabase
                .from('klse_prices_daily')
                .select('close, volume, price_date, source')
                .eq('ticker_full', stock.ticker_full)
                .gte('price_date', limitDate.toISOString());

            if (!useMock) {
                query = query.neq('source', 'seed_mock');
            }

            const { data: prices } = await query.order('price_date', { ascending: true });

            if (!prices || prices.length < 2) continue;

            const priceData = prices.map(p => ({
                close: p.close,
                volume: p.volume,
                date: p.price_date
            }));

            // Decide on the best display name
            // If short_name exists and is not just the numeric code, use it.
            // Otherwise use company_name.
            const displayName = (stock.short_name && stock.short_name !== stock.ticker_code)
                ? stock.short_name
                : (stock.company_name || stock.ticker_code);

            const analysis = analyzeStock({
                code: stock.ticker_code,
                company: displayName,
                fullName: stock.company_name,
                prices: priceData
            });

            if (analysis) {
                if (priceData.length < 50) {
                    analysis.historyLabel = 'Incomplete (' + priceData.length + 'd)';
                }
                // Tag metadata
                analysis.isTop300 = top300Set.has(stock.ticker_full);
                analysis.isShariah = stock.shariah_status === 'SHARIAH';
                analysis.shariah = analysis.isShariah; // duplicate for safety in filtering
                analysis.ticker = stock.ticker_full; // Ensure we have the full ticker for mapping
                results.push(analysis);
            }
        }

        results.sort((a, b) => b.score - a.score);
        const today = new Date().toISOString().split('T')[0];

        // 4. Update Cache (Universal cache for all tracked stocks)
        // We still keep the old keys for backward compatibility or replace them.
        // Let's replace the old key content too to keep it working.
        const legacyKey = useMock ? 'shariah_top300_hybrid' : 'shariah_top300_real';

        for (const key of [cacheKey, legacyKey]) {
            await supabase.from('screener_results_cache')
                .delete()
                .eq('as_of_date', today)
                .eq('universe', key);

            await supabase
                .from('screener_results_cache')
                .insert({
                    as_of_date: today,
                    results_json: results,
                    min_score: 0,
                    universe: key
                });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ count: results.length, status: 'computed', mode: mode })
        };

    } catch (err) {
        console.error('Computation Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
