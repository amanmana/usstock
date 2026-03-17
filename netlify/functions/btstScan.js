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
        limitDate.setDate(limitDate.getDate() - 40);

        // Update status: Initializing
        await supabase.from('scan_status').upsert({
            id: 'btst_current',
            status: 'running',
            progress: 0,
            total: stocks.length,
            message: 'Memuatkan data harga...',
            updated_at: new Date().toISOString()
        });

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
        let processedCount = 0;

        for (const stock of stocks) {
            processedCount++;
            
            // Update progress every 20 stocks to avoid database spam
            if (processedCount % 20 === 0 || processedCount === stocks.length) {
                await supabase.from('scan_status').update({
                    progress: processedCount,
                    message: `Menganalisa ${processedCount}/${stocks.length} saham...`
                }).eq('id', 'btst_current');
            }

            const prices = priceMap[stock.ticker_full];
            if (!prices || prices.length < 5) continue;

            const btstResult = calculateBtst({
                code: stock.ticker_full,
                company: stock.short_name || stock.company_name,
                prices: prices
            });

            if (btstResult && btstResult.score >= 2) {
                results.push(btstResult);
            }
        }

        // Sort by score (desc), then valueTraded (desc)
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.valueTraded - a.valueTraded;
        });

        // 4. Save Snapshot
        // Use Malaysia Time (UTC+8) for the scan_date calculation
        const now = new Date();
        const myTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const today = myTime.toISOString().split('T')[0];
        
        const { error: upsertError } = await supabase
            .from('btst_snapshots')
            .upsert({
                scan_date: today,
                results: results,
                created_at: new Date().toISOString()
            }, { onConflict: 'scan_date' });

        if (upsertError) throw upsertError;

        // Update status: Complete
        await supabase.from('scan_status').update({
            status: 'idle',
            message: `Selesai! ${results.length} calon dijumpai.`,
            updated_at: new Date().toISOString()
        }).eq('id', 'btst_current');

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
