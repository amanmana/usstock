import { supabase } from './utils/supabaseClient.js';

/**
 * List all counters in the database (both active and inactive).
 */
export const handler = async (event) => {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const activeOnly = params.get('active') !== 'false'; // default: active only

    let query = supabase
        .from('klse_stocks')
        .select('ticker_full, company_name, shariah_status, is_active, source_origin, market, is_top300')
        .order('ticker_full', { ascending: true })
        .limit(5000);

    if (activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify(data)
    };
};
