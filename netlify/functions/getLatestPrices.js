import { fetchStockData, fetchIntradayData } from './utils/scraper.js';
import { supabase } from './utils/supabaseClient.js';
import { analyzeStock } from './utils/indicators.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

    try {
        const body = JSON.parse(event.body);
        const { tickers } = body;

        if (!tickers || !Array.isArray(tickers)) {
            return { statusCode: 400, body: 'Missing or invalid tickers array' };
        }

        console.log(`Fetching latest prices and indicators for ${tickers.length} tickers...`);

        // Fetch DB metadata for Bursa stocks to get numeric codes
        const { data: stockInfoList } = await supabase
            .from('klse_stocks')
            .select('ticker_full, ticker_code, company_name, market')
            .in('ticker_full', tickers);

        const stockMap = {};
        if (stockInfoList) {
            stockInfoList.forEach(s => { stockMap[s.ticker_full] = s; });
        }

        // Fetch and Analyze in parallel
        const analysisPromises = tickers.map(async (ticker) => {
            try {
                let yfSymbol = ticker;
                const sInfo = stockMap[ticker];

                if (sInfo && (sInfo.market === 'MYR' || sInfo.market === 'KLSE')) {
                    // Normalise ticker_code: strip any trailing .KL suffix (e.g. '5126.KL' → '5126')
                    const rawCode = (sInfo.ticker_code || '').replace(/\.KL$/i, '');

                    if (rawCode && /^\d+$/.test(rawCode)) {
                        // Clean numeric code — use directly with .KL suffix
                        yfSymbol = `${rawCode}.KL`;
                    } else if (rawCode && /^0\d{3}PA$/i.test(rawCode)) {
                        // Warrant/PA code — skip (Yahoo won't have it)
                        yfSymbol = ticker; // let fetchStockData handle/fall back
                    } else {
                        // Alpha code (e.g. 'MHB.KL', 'KSL.KL') — use as-is and let
                        // fetchStockData fall back to isaham.my if Yahoo returns nothing
                        yfSymbol = ticker.endsWith('.KL') ? ticker : `${ticker.replace(/\.KL$/i, '')}.KL`;
                    }
                }

                // Fetch 3 months of daily data to compute RSI and scores
                // PLUS fetch a live quote to ensure the current price is accurate
                const [history, basic] = await Promise.all([
                    fetchIntradayData(yfSymbol, '1d', '3mo'),
                    fetchStockData(yfSymbol)
                ]);

                if (!history || history.length === 0) {
                    return {
                        ticker,
                        close: basic?.close || null,
                        volume: basic?.volume || null,
                        indicators: null
                    };
                }

                // Add live quote as the last entry in history if it's more recent
                const lastHistory = history[history.length - 1];
                const lastHistoryDatePart = lastHistory.date.split('T')[0];

                if (basic && basic.close) {
                    if (lastHistoryDatePart !== basic.priceDate) {
                        history.push({
                            ...basic,
                            date: basic.priceDate
                        });
                    } else {
                        // Update today's candle if it exists
                        history[history.length - 1] = {
                            ...lastHistory,
                            ...basic,
                            date: lastHistory.date // keep original timestamp/date
                        };
                    }
                }

                // Perform full technical analysis
                const analysis = analyzeStock({
                    code: ticker,
                    company: sInfo?.company_name || ticker,
                    prices: history
                });

                return {
                    ticker,
                    close: analysis.close,
                    volume: analysis.volume,
                    score: analysis.score,
                    momentumScore: analysis.momentumScore,
                    rsi14: analysis.stats?.rsi14,
                    dropdownPercent: analysis.stats?.dropdownPercent,
                    signals: analysis.signals,
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
