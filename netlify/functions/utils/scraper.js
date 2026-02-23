import axios from 'axios';
import * as cheerio from 'cheerio';

// Configuration for scraping
const BASE_URL = process.env.SCRAPER_BASE_URL || 'https://www.malaysiastock.biz/Corporate-Infomation.aspx?securityCode=';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

export async function fetchStockData(tickerCode) {
    try {
        // Yahoo Finance API URL structure
        // US ticker codes are used directly
        const symbol = tickerCode;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;

        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT
            },
            timeout: 10000
        });

        const result = data.chart?.result?.[0];
        if (!result) {
            console.warn(`Scraper: No Yahoo data found for ${symbol}`);
            return null;
        }

        const quote = result.indicators.quote[0];
        const timestamp = result.timestamp?.[0];

        if (!quote.close?.[0] || !timestamp) {
            console.warn(`Scraper: Incomplete data for ${symbol}`);
            return null;
        }

        const latestPrice = result.meta?.regularMarketPrice || quote.close[quote.close.length - 1] || quote.close[0];
        const close = parseFloat(latestPrice.toFixed(3));
        const open = parseFloat((quote.open[quote.open.length - 1] || quote.open[0] || close).toFixed(3));
        const high = parseFloat((quote.high[quote.high.length - 1] || quote.high[0] || close).toFixed(3));
        const low = parseFloat((quote.low[quote.low.length - 1] || quote.low[0] || close).toFixed(3));
        const volume = parseInt(quote.volume[quote.volume.length - 1] || quote.volume[0] || 0, 10);

        // Normalize date to YYYY-MM-DD
        const priceDate = new Date(timestamp * 1000).toISOString().split('T')[0];

        return {
            open,
            high,
            low,
            close,
            volume,
            priceDate
        };

    } catch (error) {
        console.error(`Error fetching Yahoo data for ${tickerCode}:`, error.message);
        return null;
    }
}

export async function fetchIntradayData(tickerCode, interval = '15m', range = '5d') {
    try {
        const symbol = tickerCode;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;

        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });

        const result = data.chart?.result?.[0];
        if (!result || !result.timestamp) {
            console.warn(`Scraper: No data found for ${symbol} with interval ${interval}`);
            return null;
        }

        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];

        // Map to standard format
        return timestamps.map((ts, i) => ({
            open: quotes.open[i] ? parseFloat(quotes.open[i].toFixed(3)) : null,
            high: quotes.high[i] ? parseFloat(quotes.high[i].toFixed(3)) : null,
            low: quotes.low[i] ? parseFloat(quotes.low[i].toFixed(3)) : null,
            close: quotes.close[i] ? parseFloat(quotes.close[i].toFixed(3)) : null,
            volume: quotes.volume[i] || 0,
            timestamp: ts,
            date: new Date(ts * 1000).toISOString()
        })).filter(p => p.close !== null);

    } catch (error) {
        console.error(`Error fetching data for ${tickerCode} (${interval}):`, error.message);
        return null;
    }
}
