import { supabase } from './utils/supabaseClient.js';

/**
 * Retrieves the latest BTST snapshot.
 */
export const handler = async (event, context) => {
    try {
        const { data, error } = await supabase
            .from('btst_snapshots')
            .select('*')
            .order('scan_date', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || { results: [], scan_date: null })
        };
    } catch (err) {
        console.error('Get BTST Latest Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
