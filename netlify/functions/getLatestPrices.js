import { fetchStockData } from './utils/scraper.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

    try {
        const body = JSON.parse(event.body);
        const { tickers } = body;

        if (!tickers || !Array.isArray(tickers)) {
            return { statusCode: 400, body: 'Missing or invalid tickers array' };
        }

        console.log(`Fetching latest prices for ${tickers.length} tickers...`);

        // Fetch prices in parallel
        const pricePromises = tickers.map(async (ticker) => {
            const data = await fetchStockData(ticker);
            return {
                ticker,
                close: data?.close || null,
                volume: data?.volume || null,
                priceDate: data?.priceDate || null,
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
