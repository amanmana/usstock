import { supabase } from './utils/supabaseClient.js';
import { analyzeStock } from './utils/indicators.js';
import { getComputeUniverse } from './utils/universe.js';

/**
 * Computes signals for the entire monitored universe (Top 300 + Favourites).
 * Stores results in cache, tagged with metadata to allow UI filtering.
 */
export const handler = async (event, context) => {
    const useMock = event.queryStringParameters?.useMock === 'true';
    const targetMarket = event.queryStringParameters?.market; // 'MYR' or 'US'
    const mode = useMock ? 'hybrid' : 'real';

    // Determine Cache Key based on market
    const marketSuffix = targetMarket ? `_${targetMarket.toLowerCase()}` : '_all';
    const cacheKey = `universe${marketSuffix}_${mode}`;

    try {
        // 1. Get Universe (Top 300 + Favourites)
        let stocks = await getComputeUniverse();
        if (!stocks || stocks.length === 0) return { statusCode: 200, body: 'No stocks found in universe.' };

        // 2. Filter by market if requested
        if (targetMarket) {
            if (targetMarket === 'MYR') {
                stocks = stocks.filter(s => s.market === 'MYR' || s.market === 'KLSE');
            } else if (targetMarket === 'US') {
                stocks = stocks.filter(s => s.market !== 'MYR' && s.market !== 'KLSE');
            }
        }

        if (stocks.length === 0) return { statusCode: 200, body: `No stocks found for market ${targetMarket}` };

        // 3. Fetch Top 300 IDs to tag them
        const { data: top300Data } = await supabase.from('klse_stocks').select('ticker_full').eq('is_top300', true);
        const top300Set = new Set(top300Data?.map(s => s.ticker_full) || []);

        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 365);

        const results = [];
        const tickerList = stocks.map(s => s.ticker_full);

        // 4. Fetch all prices in bulk
        const allPrices = [];
        let from = 0;
        const step = 1000;
        let moreData = true;

        while (moreData) {
            const { data: batch, error: priceError } = await supabase
                .from('klse_prices_daily')
                .select('ticker_full, open, high, low, close, volume, price_date, source')
                .in('ticker_full', tickerList)
                .gte('price_date', limitDate.toISOString())
                .range(from, from + step - 1)
                .order('ticker_full', { ascending: true })
                .order('price_date', { ascending: true });

            if (priceError) throw priceError;

            if (batch && batch.length > 0) {
                allPrices.push(...batch);
                from += batch.length;
                if (batch.length < step) moreData = false;
            } else {
                moreData = false;
            }

            if (from > 300000) break; // Higher cap for safety
        }

        const priceMap = {};
        allPrices.forEach(p => {
            if (!priceMap[p.ticker_full]) priceMap[p.ticker_full] = [];
            priceMap[p.ticker_full].push(p);
        });

        // 5. Analyze
        for (const stock of stocks) {
            const prices = priceMap[stock.ticker_full];
            if (!prices || prices.length < 2) continue;

            const priceData = prices
                .sort((a, b) => new Date(a.price_date) - new Date(b.price_date))
                .map(p => ({
                    open: p.open,
                    high: p.high,
                    low: p.low,
                    close: p.close,
                    volume: p.volume,
                    date: p.price_date
                }));

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
                analysis.isTop300 = top300Set.has(stock.ticker_full);
                analysis.isShariah = stock.shariah_status === 'SHARIAH';
                analysis.shariah = analysis.isShariah;
                analysis.ticker = stock.ticker_full;
                analysis.market = stock.market;
                results.push(analysis);
            }
        }

        results.sort((a, b) => b.score - a.score);
        const today = new Date().toISOString().split('T')[0];

        // 6. Update Cache
        // If it's a market-specific run, we only update that specific cache.
        // If it's 'all', we update everything (legacy support).
        const keys = targetMarket ? [cacheKey] : [cacheKey, 'shariah_top300_real', 'shariah_top300_hybrid'];

        for (const key of keys) {
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
            body: JSON.stringify({ count: results.length, status: 'computed', market: targetMarket || 'ALL' })
        };

    } catch (err) {
        console.error('Computation Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
