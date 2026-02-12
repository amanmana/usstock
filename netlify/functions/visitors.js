import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event, context) => {
    const headers = event.headers;
    // Netlify provides the client IP in these headers
    const clientIP = headers['x-nf-client-connection-ip'] || headers['client-ip'] || event.headers['x-forwarded-for'];

    const adminIP = process.env.ADMIN_IP;

    // If it's the admin IP, we don't log it, but we still return the total count
    if (clientIP && clientIP !== adminIP) {
        const ipHash = crypto.createHash('sha256').update(clientIP).digest('hex');
        try {
            await supabase
                .from('visitor_logs')
                .upsert({ ip_hash: ipHash }, { onConflict: 'ip_hash' });
        } catch (e) {
            // Ignore
        }
    }

    // Get total unique count
    const { count, error } = await supabase
        .from('visitor_logs')
        .select('*', { count: 'exact', head: true });

    if (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ count: count || 0 })
    };
};
