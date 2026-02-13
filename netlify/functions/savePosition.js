import { supabase } from './utils/supabaseClient';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const payload = JSON.parse(event.body);
        const { ticker_full, entry_price, strategy, quantity, stop_loss, target_price, max_risk, buy_date } = payload;

        if (!ticker_full) return { statusCode: 400, body: 'Missing ticker_full' };

        const { data, error } = await supabase
            .from('trading_positions')
            .upsert({
                ticker_full,
                entry_price,
                strategy,
                quantity,
                stop_loss,
                target_price,
                max_risk,
                buy_date: buy_date || new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'ticker_full' })
            .select()
            .single();

        if (error) throw error;

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (err) {
        console.error('Save Position Error:', err);
        return { statusCode: 500, body: err.message };
    }
};
