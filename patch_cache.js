import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function patchCache(ticker) {
    console.log(`Patching cache for ${ticker}...`);
    const { data: cacheRecords } = await supabase
        .from('screener_results_cache')
        .select('*')
        .order('as_of_date', { ascending: false })
        .limit(5);

    if (cacheRecords && cacheRecords.length > 0) {
        for (const record of cacheRecords) {
            if (record.results_json && Array.isArray(record.results_json)) {
                const updatedJson = record.results_json.filter(s => s.ticker !== ticker && s.ticker_full !== ticker);
                if (updatedJson.length !== record.results_json.length) {
                    console.log(`Updating record ${record.id} (${record.universe})...`);
                    await supabase
                        .from('screener_results_cache')
                        .update({ results_json: updatedJson })
                        .eq('id', record.id);
                }
            }
        }
    }
    console.log('Done.');
}

patchCache('CNP');
