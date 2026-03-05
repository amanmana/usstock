import { supabase } from './utils/supabaseClient.js';

export const handler = async () => {
    try {
        const { data: favs, error } = await supabase
            .from('favourites')
            .select('*, klse_stocks(company_name)')
            .eq('is_active', true);

        if (error) throw error;

        // Flatten the structure
        const flattened = favs.map(f => ({
            ...f,
            company_name: f.klse_stocks?.company_name || 'Unknown'
        }));

        return {
            statusCode: 200,
            body: JSON.stringify(flattened)
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
