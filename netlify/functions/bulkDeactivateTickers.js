import { supabase } from './utils/supabaseClient.js';

/**
 * Bulk deactivate (soft-delete) counters from the screener.
 * Sets is_active = false so they no longer appear in the screener.
 */
export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const { tickers } = JSON.parse(event.body);
        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing tickers array' }) };
        }

        const { data, error } = await supabase
            .from('klse_stocks')
            .update({ is_active: false })
            .in('ticker_full', tickers)
            .select('ticker_full');

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, deactivated: data?.length || 0, tickers: data?.map(d => d.ticker_full) })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
