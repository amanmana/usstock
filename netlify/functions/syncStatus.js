import { supabase } from './utils/supabaseClient';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
        const { jobId } = event.queryStringParameters || {};
        if (!jobId && event.httpMethod !== 'GET') {
            // Allow POST as fallback if someone sends body, but typically GET
        }
    }

    // Netlify Functions: params in queryStringParameters
    const jobId = event.queryStringParameters?.jobId;

    if (!jobId) {
        // Try body if POST
        if (event.body) {
            try {
                const b = JSON.parse(event.body);
                if (b.jobId) return getJobStatus(b.jobId);
            } catch (e) { }
        }
        return { statusCode: 400, body: 'Missing jobId' };
    }

    return getJobStatus(jobId);
};

async function getJobStatus(jobId) {
    try {
        const { data: job, error } = await supabase
            .from('sync_jobs')
            .select('id, status, total_tickers, processed_count, success_count, failed_count')
            .eq('id', jobId)
            .single();

        if (error) throw error;
        if (!job) return { statusCode: 404, body: 'Job not found' };

        return {
            statusCode: 200,
            body: JSON.stringify(job),
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
}
