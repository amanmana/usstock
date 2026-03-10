import { supabase } from './utils/supabaseClient.js';
import { analyzeIntraday } from './getIntradayAnalysisV2.js';
import { buildTradePlan } from './utils/buildTradePlan.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

    try {
        const body = JSON.parse(event.body);
        const { tickers } = body;

        if (!tickers || !Array.isArray(tickers)) {
            return { statusCode: 400, body: 'Missing or invalid tickers array' };
        }

        console.log(`Fetching latest comprehensive analysis for ${tickers.length} tickers...`);

        // Fetch DB metadata for stocks
        const { data: stockInfoList } = await supabase
            .from('klse_stocks')
            .select('ticker_full, ticker_code, company_name, market, shariah_status')
            .in('ticker_full', tickers);

        const stockMap = {};
        if (stockInfoList) {
            stockInfoList.forEach(s => { stockMap[s.ticker_full] = s; });
        }

        // Fetch and Analyze in parallel using analyzeIntraday to guarantee 100% sync with Modal
        const analysisPromises = tickers.map(async (ticker) => {
            try {
                const sInfo = stockMap[ticker];

                // Use the identical heavy-lifting analysis engine used by StockModal
                const analysis = await analyzeIntraday(ticker, null, false);

                if (!analysis || analysis.error || !analysis.liveStock) {
                    return {
                        ticker,
                        close: 0,
                        score: 0,
                        momentumScore: 0,
                        snapshotScore10: 0,
                        signals: ['DATA-LIMITED'],
                        verdictLabel: 'NEUTRAL',
                        systemVerdictText: 'Data terhad atau ralat memuat turun data.',
                        isLiveAnalysis: false
                    };
                }

                // Generate full trade plan for official verdict
                const plan = buildTradePlan({
                    ticker: ticker,
                    companyName: sInfo?.company_name || ticker,
                    shariahStatus: sInfo?.shariah_status || 'Unknown',
                    market: sInfo?.market || 'US',
                    analysis: analysis
                });

                return {
                    ticker,
                    close: analysis.currentPrice || analysis.liveStock?.close,
                    volume: analysis.liveStock?.volume,
                    score: analysis.liveStock?.score,
                    momentumScore: analysis.liveStock?.momentumScore,
                    snapshotScore10: analysis.liveStock?.score, // Snapshot score for table comparison
                    rsi14: analysis.liveStock?.stats?.rsi14,
                    dropdownPercent: analysis.liveStock?.stats?.dropdownPercent,
                    levels: analysis.liveStock?.levels || {
                        target1: (analysis.currentPrice || 0) * 1.05,
                        stopPrice: (analysis.currentPrice || 0) * 0.95,
                        rr1: 1.0
                    },
                    signals: analysis.liveStock?.signals || [],
                    verdictLabel: plan.verdictLabel,
                    systemVerdictText: plan.systemVerdictText || plan.advice, // Use plan.advice if text is empty
                    plan: plan, // Include full plan object for complete fallback mapping
                    isLiveAnalysis: true,
                    timestamp: new Date().toISOString()
                };
            } catch (err) {
                console.error(`Error analyzing ${ticker}:`, err.message);
                return { ticker, error: err.message };
            }
        });

        const results = await Promise.all(analysisPromises);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results)
        };

    } catch (err) {
        console.error('Error in getLatestPrices:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
