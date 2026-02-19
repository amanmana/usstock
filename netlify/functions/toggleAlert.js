import { supabase } from './utils/supabaseClient';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { symbol, enabled } = JSON.parse(event.body);

        if (!symbol) {
            return { statusCode: 400, body: 'Missing symbol' };
        }

        const { data, error } = await supabase
            .from('favourites')
            .update({ alert_enabled: enabled })
            .eq('ticker_full', symbol)
            .select()
            .single();

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
