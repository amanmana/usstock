import { supabase } from './utils/supabaseClient.js';

export const handler = async () => {
    try {
        const { data: favs, error } = await supabase
            .from('favourites')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify(favs)
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
