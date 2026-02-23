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

        // 1. Check if favourite already exists
        const { data: existing } = await supabase
            .from('favourites')
            .select('*')
            .eq('ticker_full', ticker)
            .maybeSingle();

        let isActive = true;

        if (existing) {
            isActive = !existing.is_active;
            await supabase
                .from('favourites')
                .update({ is_active: isActive, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
            // Ensure ticker exists in stocks table first
            const { data: stock } = await supabase.from('klse_stocks').select('ticker_full').eq('ticker_full', ticker).maybeSingle();
            if (!stock) {
                // If the user tries to heart something we don't know, we might need to handle it or error.
                // Usually this happens from the Main List where it already exists.
                return { statusCode: 404, body: 'Stock not found in master list.' };
            }

            await supabase
                .from('favourites')
                .insert({ ticker_full: ticker, is_active: true });
        }

        const { data: updated, error: updateErr } = await supabase
            .from('favourites')
            .select('*')
            .eq('ticker_full', ticker)
            .single();

        if (updateErr) throw updateErr;

        return {
            statusCode: 200,
            body: JSON.stringify(updated)
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
