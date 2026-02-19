import { supabase } from './utils/supabaseClient';

export const handler = async () => {
    try {
        const { data, error } = await supabase
            .from('trade_history')
            .select(`
                *,
                klse_stocks (
                    short_name
                )
            `)
            .order('sell_date', { ascending: false });

        if (error) throw error;

        // Flatten for easier frontend use
        const formatted = data.map(item => ({
            ...item,
            short_name: item.klse_stocks?.short_name || item.ticker_full
        }));

        return {
            statusCode: 200,
            body: JSON.stringify(formatted)
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
