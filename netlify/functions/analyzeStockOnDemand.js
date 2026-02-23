import { supabase } from './utils/supabaseClient.js';
import { analyzeStock } from './utils/indicators.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

    try {
        const body = JSON.parse(event.body);
        const { ticker, name } = body;

        if (!ticker) return { statusCode: 400, body: 'Missing ticker' };

        // 1. Get Stock Metadata
        const { data: stockInfo } = await supabase
            .from('klse_stocks')
            .select('*')
            .eq('ticker_full', ticker)
            .single();

        // 2. Get Price History
        const limitDate = new Date();
        limitDate.setFullYear(limitDate.getFullYear() - 1);

        const { data: prices, error: priceError } = await supabase
            .from('klse_prices_daily')
            .select('close, volume, price_date')
            .eq('ticker_full', stockInfo?.ticker_full || ticker)
            .gte('price_date', limitDate.toISOString())
            .order('price_date', { ascending: true });

        if (priceError) throw priceError;
        if (!prices || prices.length < 5) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Insufficent price data. Please try again after history import.' })
            };
        }

        const priceData = prices.map(p => ({
            close: p.close,
            volume: p.volume,
            date: p.price_date
        }));

        // 3. Analyze
        const analysis = analyzeStock({
            code: stockInfo?.ticker_code || ticker.split('.')[0],
            company: stockInfo?.short_name || stockInfo?.company_name || name || 'Unknown',
            fullName: stockInfo?.company_name || name || 'Unknown',
            prices: priceData
        });

        if (!analysis) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Analysis failed' }) };
        }

        // Add metadata
        analysis.isShariah = stockInfo?.shariah_status === 'SHARIAH';
        analysis.shariah = analysis.isShariah;
        analysis.ticker = stockInfo?.ticker_full || ticker;

        return {
            statusCode: 200,
            body: JSON.stringify(analysis)
        };

    } catch (err) {
        console.error('Analysis Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
