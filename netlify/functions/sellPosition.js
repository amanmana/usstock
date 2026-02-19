import { supabase } from './utils/supabaseClient';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const payload = JSON.parse(event.body);
        const {
            ticker_full,
            sell_price,
            quantity,
            trade_type,
            notes,
            // Original data needed for logging
            entry_price,
            strategy,
            buy_date
        } = payload;

        if (!ticker_full || !sell_price || !quantity) {
            return { statusCode: 400, body: 'Missing required fields' };
        }

        // 1. Get current position to check quantity
        const { data: currentPos, error: fetchError } = await supabase
            .from('trading_positions')
            .select('*')
            .eq('ticker_full', ticker_full)
            .single();

        if (fetchError || !currentPos) throw new Error("Position not found");

        const remainingQty = currentPos.quantity - quantity;

        // 2. Handle position update/delete
        if (remainingQty < 0) {
            return { statusCode: 400, body: 'Sell quantity exceeds position quantity' };
        }

        if (remainingQty === 0) {
            // Full Sell -> Delete position
            const { error: delError } = await supabase
                .from('trading_positions')
                .delete()
                .eq('ticker_full', ticker_full);
            if (delError) throw delError;
        } else {
            // Partial Sell -> Update quantity
            const { error: updError } = await supabase
                .from('trading_positions')
                .update({
                    quantity: remainingQty,
                    updated_at: new Date().toISOString()
                })
                .eq('ticker_full', ticker_full);
            if (updError) throw updError;
        }

        // 3. Log to trade_history
        const pnl_amount = (sell_price - entry_price) * quantity;
        const pnl_percent = ((sell_price - entry_price) / entry_price) * 100;

        const { error: histError } = await supabase
            .from('trade_history')
            .insert({
                ticker_full,
                entry_price,
                sell_price,
                quantity,
                strategy,
                trade_type: trade_type || 'REAL',
                buy_date,
                sell_date: new Date().toISOString(),
                pnl_amount,
                pnl_percent,
                notes
            });

        if (histError) throw histError;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: remainingQty === 0 ? 'Full sell complete' : `Partial sell complete. Remaining: ${remainingQty}`,
                remaining_quantity: remainingQty
            })
        };

    } catch (err) {
        console.error('Sell Position Error:', err);
        return { statusCode: 500, body: err.message };
    }
};
