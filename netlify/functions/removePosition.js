import { supabase } from './utils/supabaseClient.js';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const { ticker_full } = JSON.parse(event.body);
        if (!ticker_full) return { statusCode: 400, body: 'Missing ticker_full' };

        const { error } = await supabase
            .from('trading_positions')
            .delete()
            .eq('ticker_full', ticker_full);

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, ticker_full })
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
