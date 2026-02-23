import { supabase } from './utils/supabaseClient.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        // ... logic
        return { statusCode: 405, body: 'Make sure to call this via POST' };
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        // Check if job exists
        const { data: existingJobs } = await supabase
            .from('sync_jobs')
            .select('id, status')
            .eq('as_of_date', today)
            .limit(1);

        if (existingJobs && existingJobs.length > 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    status: 'exists',
                    jobId: existingJobs[0].id,
                    message: 'Sync job already exists for today.'
                }),
            };
        }

        // Get count
        // Fix: count is returned as 'count', data as 'data'
        const { count, error: countError } = await supabase
            .from('klse_stocks')
            .select('ticker_full', { count: 'exact', head: true })
            .eq('is_active', true);

        const total = count || 300;

        // Create new job
        const { data: newJob, error: createError } = await supabase
            .from('sync_jobs')
            .insert({
                as_of_date: today,
                status: 'queued',
                total_tickers: total,
                processed_count: 0
            })
            .select()
            .single();

        if (createError) throw createError;

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'created',
                jobId: newJob.id,
                total: newJob.total_tickers,
                batches: Math.ceil(total / 25),
            }),
        };

    } catch (err) {
        console.error('Func Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
