import { supabase } from './utils/supabaseClient.js';

/**
 * Toggles a ticker's favourite status.
 * If ticker is NOT in Top 300, it remains in klse_stocks but hidden from Top 300 UI.
 */
export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const { symbol } = JSON.parse(event.body);
        if (!symbol) return { statusCode: 400, body: 'Missing symbol' };

        const ticker = symbol.toUpperCase();

        let canonicalTicker = ticker;
        const { data: stock } = await supabase.from('klse_stocks').select('ticker_full').eq('ticker_full', ticker).maybeSingle();

        if (!stock) {
            // Try to find by short_name or partial company match (crucial for Bursa alpha vs numeric)
            const clean = ticker.replace('.KL', '');
            const { data: resolved } = await supabase
                .from('klse_stocks')
                .select('ticker_full')
                .or(`short_name.eq."${clean}",ticker_code.eq."${clean}"`)
                .limit(1)
                .maybeSingle();

            if (resolved) {
                canonicalTicker = resolved.ticker_full;
            } else {
                return { statusCode: 404, body: `Stock ${ticker} not found in master list.` };
            }
        } else {
            canonicalTicker = stock.ticker_full;
        }

        // 1. Check if favourite already exists (using canonical ticker)
        const { data: existing } = await supabase
            .from('favourites')
            .select('*')
            .eq('ticker_full', canonicalTicker)
            .maybeSingle();

        let isActive = true;

        if (existing) {
            isActive = !existing.is_active;
            await supabase
                .from('favourites')
                .update({ is_active: isActive, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('favourites')
                .insert({ ticker_full: canonicalTicker, is_active: true });
        }

        const { data: updated, error: updateErr } = await supabase
            .from('favourites')
            .select('*, klse_stocks(company_name)')
            .eq('ticker_full', canonicalTicker)
            .single();

        if (updateErr) throw updateErr;

        return {
            statusCode: 200,
            body: JSON.stringify({
                ...updated,
                company_name: updated.klse_stocks?.company_name
            })
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
