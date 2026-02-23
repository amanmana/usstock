import { supabase } from './utils/supabaseClient.js';
import { analyzeStock } from './utils/indicators.js';
import { getComputeUniverse } from './utils/universe.js';

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

        // 3. Fetch all prices for Top 300 + Favourites in bulk with pagination
        const tickerList = stocks.map(s => s.ticker_full);

        const allPrices = [];
        let from = 0;
        const step = 1000; // Supabase default/max page size
        let moreData = true;

        while (moreData) {
            const { data: batch, error: priceError } = await supabase
                .from('klse_prices_daily')
                .select('ticker_full, open, high, low, close, volume, price_date, source')
                .in('ticker_full', tickerList)
                .gte('price_date', limitDate.toISOString())
                .range(from, from + step - 1)
                .order('ticker_full', { ascending: true }) // Stable ordering for pagination
                .order('price_date', { ascending: true });

            if (priceError) throw priceError;

            if (batch && batch.length > 0) {
                allPrices.push(...batch);
                from += batch.length;
                if (batch.length < step) {
                    moreData = false;
                }
            } else {
                moreData = false;
            }

            // Safety cap
            if (from > 100000) break;
        }

        // Group prices by ticker
        const priceMap = {};
        allPrices.forEach(p => {
            if (!priceMap[p.ticker_full]) priceMap[p.ticker_full] = [];
            priceMap[p.ticker_full].push(p);
        });

        // 4. Loop and Analyze
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
                if (priceData.length < 50) {
                    analysis.historyLabel = 'Incomplete (' + priceData.length + 'd)';
                }
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

        // 4. Update Cache (Universal cache for all tracked stocks)
        const keys = [
            cacheKey,                                    // universe_all_real or universe_all_hybrid
            'shariah_top300_real',                       // Legacy real
            'shariah_top300_hybrid'                      // Legacy hybrid
        ];

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
            body: JSON.stringify({ count: results.length, status: 'computed', mode: useMock ? 'mock' : 'real' })
        };

    } catch (err) {
        console.error('Computation Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
