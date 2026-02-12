import { supabase } from './utils/supabaseClient';

export const handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

    try {
        // 1. Fetch all active stocks
        const { data: stocks } = await supabase.from('klse_stocks').select('ticker_full, ticker_code').eq('is_active', true);

        if (!stocks) return { statusCode: 200, body: 'No stocks found' };

        console.log(`Seeding data for ${stocks.length} stocks...`);

        const updates = [];
        const today = new Date();

        // 2. Generate 60 days of history for each
        for (const stock of stocks) {
            let price = (Math.random() * 5) + 0.5; // Start random price

            for (let i = 60; i >= 0; i--) {
                const date = new Date();
                date.setDate(today.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];

                // Random walk
                const change = (Math.random() - 0.48) * 0.10; // Slightly upward drift
                price = price * (1 + change);
                if (price < 0.05) price = 0.05;

                const volume = Math.floor(Math.random() * 500000) + 50000; // 50k - 550k volume

                updates.push({
                    ticker_full: stock.ticker_full,
                    price_date: dateStr,
                    close: parseFloat(price.toFixed(3)),
                    volume: volume,
                    source: 'seed_mock'
                });
            }
        }

        // 3. Bulk Insert (Chunks of 1000)
        // updates length = 50 * 61 = 3050. Supabase limit is usually large enough but safe to chunk.
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from('klse_prices_daily').upsert(chunk, { onConflict: 'ticker_full, price_date' });
            if (error) console.error('Chunk Seed Error:', error);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Seeded ${updates.length} rows.` })
        };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
