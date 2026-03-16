import { supabase } from './utils/supabaseClient.js';
import { getComputeUniverse } from './utils/universe.js';
import { calculateBtst } from './utils/btstEngine.js';

/**
 * Runs the daily BTST scan.
 * Intended to run at 3:30 PM Bursa time.
 */
export const handler = async (event, context) => {
    try {
        console.log('Starting daily BTST scan...');
        
        // 1. Get Universe
        const stocks = await getComputeUniverse();
        if (!stocks || stocks.length === 0) {
            return { statusCode: 200, body: 'No stocks found in universe.' };
        }

        const tickerList = stocks.map(s => s.ticker_full);
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 40); // Need enough days for SMA20 + stats

        // 2. Fetch prices in bulk
        const { data: allPrices, error: priceError } = await supabase
            .from('klse_prices_daily')
            .select('ticker_full, open, high, low, close, volume, price_date')
            .in('ticker_full', tickerList)
            .gte('price_date', limitDate.toISOString())
            .order('price_date', { ascending: true });

        if (priceError) throw priceError;

        const priceMap = {};
        allPrices.forEach(p => {
            if (!priceMap[p.ticker_full]) priceMap[p.ticker_full] = [];
            priceMap[p.ticker_full].push({
                open: p.open,
                high: p.high,
                low: p.low,
                close: p.close,
                volume: p.volume,
                date: p.price_date
            });
        });

        // 3. Process BTST
        const results = [];
        for (const stock of stocks) {
            const prices = priceMap[stock.ticker_full];
            if (!prices || prices.length < 5) continue;

            const btstResult = calculateBtst({
                code: stock.ticker_full,
                company: stock.short_name || stock.company_name,
                prices: prices
            });

            if (btstResult && btstResult.score >= 4) { // Minimum score threshold to be listed
                results.push(btstResult);
            }
        }

        // Sort by score (desc), then valueTraded (desc)
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.valueTraded - a.valueTraded;
        });

        // 4. Save Snapshot
        const today = new Date().toISOString().split('T')[0];
        
        const { error: upsertError } = await supabase
            .from('btst_snapshots')
            .upsert({
                scan_date: today,
                results: results,
                created_at: new Date().toISOString()
            }, { onConflict: 'scan_date' });

        if (upsertError) throw upsertError;

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'success',
                date: today,
                count: results.length
            })
        };

    } catch (err) {
        console.error('BTST Scan Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
