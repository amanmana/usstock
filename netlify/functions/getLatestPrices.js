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
                    if (sInfo.ticker_code && /^\d+$/.test(sInfo.ticker_code)) {
                        yfSymbol = `${sInfo.ticker_code}.KL`;
                    } else if (!/^\d+\.KL$/.test(ticker)) {
                        // Alpha symbol like MHB.KL - try to find numeric code in DB
                        const { data: searchMatch } = await supabase
                            .from('klse_stocks')
                            .select('ticker_code')
                            .ilike('company_name', `%${sInfo.company_name}%`)
                            .not('ticker_code', 'ilike', '%KL%')
                            .limit(1)
                            .single();

                        if (searchMatch && /^\d+$/.test(searchMatch.ticker_code)) {
                            yfSymbol = `${searchMatch.ticker_code}.KL`;
                            console.log(`Resolved alpha ${ticker} to numeric ${yfSymbol}`);
                        } else {
                            yfSymbol = ticker.endsWith('.KL') ? ticker : `${ticker}.KL`;
                        }
                    }
                }

                // Fetch 3 months of daily data to compute RSI and scores
                const history = await fetchIntradayData(yfSymbol, '1d', '3mo');

                if (!history || history.length === 0) {
                    // Fallback to simple price if history fails
                    const basic = await fetchStockData(yfSymbol);
                    return {
                        ticker,
                        close: basic?.close || null,
                        volume: basic?.volume || null,
                        indicators: null
                    };
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
