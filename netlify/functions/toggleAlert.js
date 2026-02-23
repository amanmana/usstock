import { supabase } from './utils/supabaseClient.js';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { symbol, enabled, settings } = JSON.parse(event.body);

        if (!symbol) {
            return { statusCode: 400, body: 'Missing symbol' };
        }

        // Build update object. 
        // If 'settings' is provided, we use granular flags. 
        // Otherwise fallback to 'enabled' for alert_go.
        const updateObj = settings ? {
            alert_go: settings.alert_go,
            alert_tp: settings.alert_tp,
            alert_sl: settings.alert_sl,
            alert_enabled: settings.alert_go || settings.alert_tp || settings.alert_sl
        } : {
            alert_enabled: enabled,
            alert_go: enabled // Legacy support
        };

        const { data, error } = await supabase
            .from('favourites')
            .update(updateObj)
            .eq('ticker_full', symbol)
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
