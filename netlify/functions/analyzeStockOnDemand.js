import { supabase } from './utils/supabaseClient.js';
import { analyzeIntraday } from './getIntradayAnalysisV2.js';
import { buildTradePlan } from './utils/buildTradePlan.js';

export const handler = async (event, context) => {
    // Support both POST and GET
    const method = event.httpMethod;
    let ticker;

    if (method === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            ticker = body.ticker;
        } catch (e) {
            console.error("Error parsing POST body", e);
        }
    } else if (method === 'GET') {
        ticker = event.queryStringParameters?.ticker;
    } else {
        return { statusCode: 405, body: 'GET or POST required' };
    }

    if (!ticker) return { statusCode: 400, body: 'Missing ticker' };

    try {
        // 1. Fetch Analysis Data
        const analysis = await analyzeIntraday(ticker, null, false);

        if (!analysis || analysis.error) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: analysis?.error || 'Analysis failed' })
            };
        }

        // 2. Fetch Metadata (Company Name & Shariah Status)
        const { data: stockInfo } = await supabase
            .from('klse_stocks')
            .select('company_name, shariah_status')
            .eq('ticker_full', ticker)
            .single();

        // 3. Build Standardized Trade Plan
        const tradePlan = buildTradePlan({
            ticker,
            companyName: stockInfo?.company_name,
            shariahStatus: stockInfo?.shariah_status,
            analysis
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(tradePlan) // Return naked tradePlan as requested
        };

    } catch (err) {
        console.error('Analysis Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};

