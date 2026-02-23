import { supabase } from './utils/supabaseClient.js';

/**
 * Netlify function to fetch historical price data for a specific ticker.
 * Returns the last 100 trading days for chart rendering.
 */
export const handler = async (event, context) => {
    const { ticker } = event.queryStringParameters || {};

    if (!ticker) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Ticker is required' })
        };
    }

    try {
        const { data, error } = await supabase
            .from('klse_prices_daily')
            .select('price_date, close, volume')
            .eq('ticker_full', ticker)
            .order('price_date', { ascending: false })
            .limit(100);

        if (error) throw error;

        // Return in chronological order (oldest first for chart)
        const sortedData = (data || []).reverse().map(p => ({
            date: p.price_date,
            close: p.close,
            volume: p.volume
        }));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sortedData)
        };
    } catch (err) {
        console.error('Error fetching history:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
