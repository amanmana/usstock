import { supabase } from './utils/supabaseClient.js';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const payload = JSON.parse(event.body);
        const { id, ...updates } = payload;

        if (!id) return { statusCode: 400, body: 'Missing id' };

        // Recalculate PnL if prices or quantity changed
        if (updates.sell_price || updates.entry_price || updates.quantity) {
            const sell = updates.sell_price;
            const entry = updates.entry_price;
            const qty = updates.quantity;

            if (sell && entry && qty) {
                updates.pnl_amount = (sell - entry) * qty;
                updates.pnl_percent = ((sell - entry) / entry) * 100;
            }
        }

        const { data, error } = await supabase
            .from('trade_history')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
