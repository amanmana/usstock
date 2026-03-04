import { supabase } from './utils/supabaseClient.js';
import axios from 'axios';

export const handler = async (event) => {
    const { q } = event.queryStringParameters || {};
    if (!q) return { statusCode: 200, body: JSON.stringify([]) };

    try {
        const query = q.toUpperCase().trim();

        // 1. Search in local DB first
        const { data: localData, error } = await supabase
            .from('klse_stocks')
            .select('ticker_full, company_name, ticker_code, short_name')
            .or(`ticker_code.ilike.%${query}%,company_name.ilike.%${query}%,ticker_full.ilike.%${query}%,short_name.ilike.%${query}%`)
            .limit(5);

        if (error) throw error;

        // Prioritize exact matches
        const localSorted = (localData || []).sort((a, b) => {
            const aCode = a.ticker_code === query ? -1 : 0;
            const bCode = b.ticker_code === query ? -1 : 0;
            return aCode - bCode;
        });

        // 2. Always also search Yahoo Finance to find tickers not in our DB
        let yahooResults = [];
        try {
            const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=US&quotesCount=8&newsCount=0&listsCount=0`;
            const { data: yData } = await axios.get(yahooUrl, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // Filter only US equities and ETFs, exclude options/futures/forex
            const validTypes = ['EQUITY', 'ETF', 'MUTUALFUND'];
            yahooResults = (yData?.quotes || [])
                .filter(q => validTypes.includes(q.quoteType) && q.symbol && !q.symbol.includes('='))
                .slice(0, 6)
                .map(q => ({
                    ticker_full: q.symbol,
                    ticker_code: q.symbol,
                    company_name: q.longname || q.shortname || q.symbol,
                    short_name: q.shortname || q.symbol,
                    exchange: q.exchange,
                    quoteType: q.quoteType,
                    is_yahoo_result: true // flag to show it's from Yahoo, not local DB
                }));
        } catch (yahooErr) {
            console.error('Yahoo Finance search failed:', yahooErr.message);
            // Silently fall back to local results only
        }

        // 3. Merge: local DB results first, then Yahoo results that aren't already in local
        const localTickers = new Set(localSorted.map(s => s.ticker_full));
        const newFromYahoo = yahooResults.filter(y => !localTickers.has(y.ticker_full));

        const merged = [...localSorted, ...newFromYahoo].slice(0, 10);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged)
        };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
