import { fetchStockData } from './utils/scraper.js';
import { supabase } from './utils/supabaseClient.js';
export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

    try {
        const body = JSON.parse(event.body);
        const { tickers } = body;

        if (!tickers || !Array.isArray(tickers)) {
            return { statusCode: 400, body: 'Missing or invalid tickers array' };
        }

        console.log(`Fetching latest prices for ${tickers.length} tickers...`);

        // Fetch DB metadata for Bursa stocks
        const { data: stockInfoList } = await supabase
            .from('klse_stocks')
            .select('ticker_full, ticker_code, market')
            .in('ticker_full', tickers);

        const stockMap = {};
        if (stockInfoList) {
            stockInfoList.forEach(s => { stockMap[s.ticker_full] = s; });
        }

        // Fetch prices in parallel
        const pricePromises = tickers.map(async (ticker) => {
            let yfSymbol = ticker;
            const sInfo = stockMap[ticker];

            // Map to numeric ticker if available in local DB for Bursa stocks
            if (sInfo && (sInfo.market === 'MYR' || sInfo.market === 'KLSE')) {
                // Prioritize numeric code for Yahoo chart API stability
                if (sInfo.ticker_code && /^\d+$/.test(sInfo.ticker_code)) {
                    yfSymbol = `${sInfo.ticker_code}.KL`;
                } else {
                    // Fallback to ticker_full or search pattern
                    yfSymbol = ticker.endsWith('.KL') ? ticker : `${ticker}.KL`;
                }
            }

            const data = await fetchStockData(yfSymbol);

            // If primary fetch failed and it was a name-based ticker, try numeric if we find one
            let finalData = data;
            if (!finalData && ticker.endsWith('.KL') && !/^\d+\.KL$/.test(ticker)) {
                // No price for alpha symbol like MHB.KL, and we didn't have sInfo.ticker_code before
                // (Wait, we already checked stockMap if it exists)
            }

            return {
                ticker,
                close: finalData?.close || null,
                volume: finalData?.volume || null,
                priceDate: finalData?.priceDate || null,
                timestamp: new Date().toISOString()
            };
        });

        const results = await Promise.all(pricePromises);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
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
