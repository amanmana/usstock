import { supabase } from './utils/supabaseClient.js';

/**
 * Updates the Shariah status and active status of a stock.
 * Used for manual corrections by the user.
 */
export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { ticker_full, shariah_status } = JSON.parse(event.body);

        if (!ticker_full || !shariah_status) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing ticker_full or shariah_status' })
            };
        }

        const isActive = shariah_status === 'SHARIAH';

        const { data, error } = await supabase
            .from('klse_stocks')
            .update({
                shariah_status: shariah_status,
                is_active: isActive,
                manual_shariah_correction: true,
                updated_at: new Date().toISOString()
            })
            .eq('ticker_full', ticker_full)
            .select();

        if (error) {
            throw error;
        }

        // If marked as NON_SHARIAH, we should also remove it from favourites to be clean
        if (!isActive) {
            await supabase
                .from('favourites')
                .delete()
                .eq('ticker_full', ticker_full);

            // ALSO: Patch the screener_results_cache to remove this ticker immediately
            try {
                const { data: cacheRecords } = await supabase
                    .from('screener_results_cache')
                    .select('*')
                    .order('as_of_date', { ascending: false })
                    .limit(5);

                if (cacheRecords && cacheRecords.length > 0) {
                    for (const record of cacheRecords) {
                        if (record.results_json && Array.isArray(record.results_json)) {
                            const updatedJson = record.results_json.filter(s => s.ticker !== ticker_full && s.ticker_full !== ticker_full);
                            if (updatedJson.length !== record.results_json.length) {
                                await supabase
                                    .from('screener_results_cache')
                                    .update({ results_json: updatedJson })
                                    .eq('id', record.id);
                            }
                        }
                    }
                }
            } catch (cacheErr) {
                console.error('Failed to patch screener cache:', cacheErr);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: `Stock ${ticker_full} updated to ${shariah_status}`,
                data: data
            })
        };

    } catch (err) {
        console.error('Update Shariah Status Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
