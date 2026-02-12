import { supabase } from './utils/supabaseClient';

export const handler = async () => {
    try {
        const { data: favs, error } = await supabase
            .from('favourites')
            .select('ticker_full')
            .eq('is_active', true);

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify(favs.map(f => f.ticker_full))
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
