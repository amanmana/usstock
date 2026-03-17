import { supabase } from './utils/supabaseClient.js';

/**
 * Retrieves the status of a specific scan process.
 */
export const handler = async (event, context) => {
    try {
        const id = event.queryStringParameters?.id || 'btst_current';

        const { data, error } = await supabase
            .from('scan_status')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };
    } catch (err) {
        console.error('Get Scan Status Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
