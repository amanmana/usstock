import { supabase } from './utils/supabaseClient.js';
import { fetchIntradayData } from './utils/scraper.js';

export const handler = async (event, context) => {
    const { ticker, interval = '1d', range = '5d' } = event.queryStringParameters || {};

    if (!ticker) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Ticker is required' })
        };
    }

    try {
        let historyData = [];

        if (interval === '1d') {
            // Use database for daily history (efficient for 100 days)
            const { data, error } = await supabase
                .from('klse_prices_daily')
                .select('price_date, close, volume')
                .eq('ticker_full', ticker)
                .order('price_date', { ascending: false })
                .limit(100);

            if (error) throw error;
            historyData = (data || []).reverse().map(p => ({
                date: p.price_date,
                close: p.close,
                volume: p.volume
            }));
        } else {
            // Use scraper for intraday history (4h, 1h, 15m etc)
            // Yahoo supports: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
            // Note: 4h is not natively supported by Yahoo v8 chart directly as an interval sometimes, 
            // but we can fetch 1h and aggregate OR just use 1h for '4h-like' detail if sufficient.
            // Actually 1h is widely supported.
            const yahooInterval = interval === '4h' ? '1h' : interval;
            const intraday = await fetchIntradayData(ticker, yahooInterval, range);

            if (intraday) {
                historyData = intraday.map(p => ({
                    date: p.date,
                    close: p.close,
                    volume: p.volume,
                    timestamp: p.timestamp
                }));
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(historyData)
        };
    } catch (err) {
        console.error('Error fetching history:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
