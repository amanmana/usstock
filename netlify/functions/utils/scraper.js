import axios from 'axios';
import * as cheerio from 'cheerio';

// Configuration for scraping
const BASE_URL = process.env.SCRAPER_BASE_URL || 'https://www.malaysiastock.biz/Corporate-Infomation.aspx?securityCode=';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

export async function fetchStockData(tickerCode) {
    try {
        const symbol = tickerCode;
        const timestamp = Date.now();

        // Use v8/finance/chart as primary since v7/finance/quote now returns 401 for many requests
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m&_=${timestamp}`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        const result = data.chart?.result?.[0];

        // If Yahoo returns no result, try isaham.my as fallback (for alpha-symbol Bursa stocks)
        if (!result) {
            return await fetchFromIsaham(tickerCode);
        }

        const meta = result.meta;
        const indicator = result.indicators?.quote?.[0];

        // Use regularMarketPrice from meta as it's the most real-time
        const latestPrice = meta?.regularMarketPrice || (indicator?.close && indicator.close[indicator.close.length - 1]);

        if (latestPrice === undefined || latestPrice === null) {
            return await fetchFromIsaham(tickerCode);
        }

        // Date in YYYY-MM-DD
        const priceDate = new Date().toISOString().split('T')[0];

        return {
            open: parseFloat((meta.regularMarketOpen || indicator?.open?.[0] || latestPrice).toFixed(3)),
            high: parseFloat((meta.regularMarketDayHigh || indicator?.high?.[0] || latestPrice).toFixed(3)),
            low: parseFloat((meta.regularMarketDayLow || indicator?.low?.[0] || latestPrice).toFixed(3)),
            close: parseFloat(latestPrice.toFixed(3)),
            volume: parseInt(meta.regularMarketVolume || indicator?.volume?.[0] || 0, 10),
            priceDate
        };
    } catch (error) {
        console.error(`Scraper error for ${tickerCode}:`, error.message);
        // On network error, also try isaham fallback
        return await fetchFromIsaham(tickerCode);
    }
}

/**
 * Fallback: Scrape live price from isaham.my for Bursa stocks that Yahoo Finance cannot resolve.
 * Works for both alpha (MHB) and numeric (5186) Bursa stock codes.
 * isaham.my embeds a StockQuote JSON-LD block with clean price data.
 */
async function fetchFromIsaham(tickerCode) {
    try {
        // Convert ticker to isaham slug: strip .KL suffix, lowercase
        // e.g. 'MHB.KL' → 'mhb', '5186.KL' → '5186', 'MHB' → 'mhb'
        const slug = tickerCode.replace(/\.KL$/i, '').toLowerCase();
        const url = `https://www.isaham.my/stock/${slug}`;

        const { data: html } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 8000
        });

        const $ = cheerio.load(html);
        let stockQuote = null;

        // Parse all JSON-LD blocks to find the StockOrOptionQuote / FinancialProduct block with price
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const json = JSON.parse($(el).text());
                // The block we want has "price" key at top level or nested
                if (json.price !== undefined) {
                    stockQuote = json;
                }
            } catch (e) { /* skip malformed JSON */ }
        });

        if (!stockQuote || !stockQuote.price) {
            // Try scraping price from meta tag as last resort
            const metaPrice = $('meta[itemprop="price"]').attr('content');
            if (metaPrice) {
                const price = parseFloat(metaPrice);
                if (!isNaN(price)) {
                    console.log(`isaham.my meta fallback for ${tickerCode}: ${price}`);
                    return {
                        open: price, high: price, low: price, close: price,
                        volume: 0, priceDate: new Date().toISOString().split('T')[0]
                    };
                }
            }
            console.warn(`isaham.my: No price found for ${tickerCode}`);
            return null;
        }

        const price = parseFloat(stockQuote.price);
        const high = parseFloat(stockQuote.high || price);
        const low = parseFloat(stockQuote.low || price);
        const open = parseFloat(stockQuote.open || price);
        const volume = parseInt(stockQuote.volumeNumber || stockQuote.volume || 0, 10);

        console.log(`isaham.my fallback for ${tickerCode}: ${price}`);

        return {
            open: parseFloat(open.toFixed(3)),
            high: parseFloat(high.toFixed(3)),
            low: parseFloat(low.toFixed(3)),
            close: parseFloat(price.toFixed(3)),
            volume,
            priceDate: new Date().toISOString().split('T')[0]
        };
    } catch (err) {
        console.error(`isaham.my fallback failed for ${tickerCode}:`, err.message);
        return null;
    }
}


export async function fetchIntradayData(tickerCode, interval = '15m', range = '5d') {
    try {
        const symbol = tickerCode;
        const timestamp = Date.now();
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}&_=${timestamp}`;

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
