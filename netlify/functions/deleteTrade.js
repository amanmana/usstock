import { supabase } from './utils/supabaseClient.js';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const { id } = JSON.parse(event.body);
        if (!id) return { statusCode: 400, body: 'Missing id' };

        // 1. Fetch the trade details before deleting
        const { data: trade, error: fetchError } = await supabase
            .from('trade_history')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !trade) throw new Error("Trade record not found");

        const { ticker_full, quantity, entry_price, strategy, buy_date } = trade;

        // 2. Check if the position still exists
        const { data: currentPos, error: posError } = await supabase
            .from('trading_positions')
            .select('*')
            .eq('ticker_full', ticker_full)
            .maybeSingle();

        if (currentPos) {
            // Restore quantity to existing position
            await supabase
                .from('trading_positions')
                .update({
                    quantity: currentPos.quantity + quantity,
                    updated_at: new Date().toISOString()
                })
                .eq('ticker_full', ticker_full);
        } else {
            // Re-create the position if it was fully sold
            await supabase
                .from('trading_positions')
                .insert({
                    ticker_full,
                    quantity,
                    entry_price,
                    strategy,
                    buy_date,
                    updated_at: new Date().toISOString()
                });
        }

        // 3. Finally delete from history
        const { error: delError } = await supabase
            .from('trade_history')
            .delete()
            .eq('id', id);

        if (delError) throw delError;

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Trade deleted and position restored' })
        };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};
