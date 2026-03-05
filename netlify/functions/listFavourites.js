import { supabase } from './utils/supabaseClient.js';

export const handler = async () => {
    try {
        const { data: favs, error } = await supabase
            .from('favourites')
            .select('*, klse_stocks(company_name, short_name, ticker_code, market)')
            .eq('is_active', true);

        if (error) throw error;

        // Flatten and normalize Market
        const flattened = favs.map(f => {
            const rawMarket = f.klse_stocks?.market || (f.ticker_full?.endsWith('.KL') ? 'MYR' : 'US');
            let market = 'US';
            if (rawMarket.includes('MYR') || rawMarket.includes('KLSE')) {
                market = 'MYR';
            }

            return {
                ...f,
                company_name: f.klse_stocks?.company_name || 'Unknown',
                short_name: f.klse_stocks?.short_name || '',
                ticker_code: f.klse_stocks?.ticker_code || '',
                market
            };
        });

        return {
            statusCode: 200,
            body: JSON.stringify(flattened)
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
