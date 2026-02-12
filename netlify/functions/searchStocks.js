import { supabase } from './utils/supabaseClient';

export const handler = async (event) => {
    const { q } = event.queryStringParameters || {};
    if (!q) return { statusCode: 200, body: JSON.stringify([]) };

    try {
        const query = q.toUpperCase().trim();

        // Search in local klse_stocks
        // We look for matches in ticker_code, ticker_full, or company_name
        const { data, error } = await supabase
            .from('klse_stocks')
            .select('ticker_full, company_name, ticker_code, short_name')
            .or(`ticker_code.ilike.%${query}%,company_name.ilike.%${query}%,ticker_full.ilike.%${query}%,short_name.ilike.%${query}%`)
            .limit(10);

        if (error) throw error;

        // Prioritize exact matches in ticker_code or ticker_full
        const sorted = data.sort((a, b) => {
            const aCode = a.ticker_code === query ? -1 : 0;
            const bCode = b.ticker_code === query ? -1 : 0;
            return aCode - bCode;
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sorted)
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
