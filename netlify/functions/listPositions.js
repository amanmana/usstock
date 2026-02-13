import { supabase } from './utils/supabaseClient';

export const handler = async () => {
    try {
        const { data: positions, error } = await supabase
            .from('trading_positions')
            .select('*');

        if (error) throw error;

        // Convert key-value format expected by many parts of the app if needed, 
        // but usePositions will handle the mapping.
        return {
            statusCode: 200,
            body: JSON.stringify(positions)
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
