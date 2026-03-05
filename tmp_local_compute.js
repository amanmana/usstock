import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { analyzeStock } from './netlify/functions/utils/indicators.js';

// Setup Mock Supabase client
import fs from 'fs';
const envMap = {};
const env = fs.readFileSync('./.env', 'utf-8');
env.split('\n').forEach(line => {
    if (line && line.includes('=')) {
        const [key, ...rest] = line.split('=');
        envMap[key.trim()] = rest.join('=').trim();
    }
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envMap['VITE_SUPABASE_URL'];
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || envMap['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function compute() {
    console.log("Starting computeScreener locally...");
    const cacheKey = `universe_all_hybrid`;
    try {
        const { data: top300 } = await supabase
            .from('klse_stocks')
            .select('*')
            .eq('is_top300', true)
            .eq('is_active', true);

        const stocks = top300 || [];
        const top300Set = new Set(stocks.map(s => s.ticker_full));
        console.log(`Universe sizes: ${stocks.length}`);

        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 365);
        const results = [];
        const tickerList = stocks.map(s => s.ticker_full);

        const allPrices = [];
        let from = 0;
        const step = 1000;
        let moreData = true;

        while (moreData) {
            const { data: batch, error } = await supabase
                .from('klse_prices_daily')
                .select('ticker_full, open, high, low, close, volume, price_date')
                .in('ticker_full', tickerList)
                .gte('price_date', limitDate.toISOString())
                .range(from, from + step - 1)
                .order('ticker_full', { ascending: true })
                .order('price_date', { ascending: true });

            if (error) throw error;
            if (batch && batch.length > 0) {
                allPrices.push(...batch);
                from += batch.length;
                if (batch.length < step) moreData = false;
            } else {
                moreData = false;
            }
            if (from > 100000) break;
            process.stdout.write(`Fetched ${allPrices.length} rows...\r`);
        }
        console.log(`\nTotal prices fetched: ${allPrices.length}`);

        const priceMap = {};
        allPrices.forEach(p => {
            if (!priceMap[p.ticker_full]) priceMap[p.ticker_full] = [];
            priceMap[p.ticker_full].push(p);
        });

        for (const stock of stocks) {
            const prices = priceMap[stock.ticker_full];
            if (!prices || prices.length < 2) continue;

            const priceData = prices
                .sort((a, b) => new Date(a.price_date) - new Date(b.price_date))
                .map(p => ({
                    open: p.open, high: p.high, low: p.low, close: p.close,
                    volume: p.volume, date: p.price_date
                }));

            const analysis = analyzeStock({
                code: stock.ticker_code,
                company: stock.short_name || stock.company_name,
                fullName: stock.company_name,
                prices: priceData
            });

            if (analysis) {
                analysis.isTop300 = top300Set.has(stock.ticker_full);
                analysis.isShariah = stock.shariah_status === 'SHARIAH';
                analysis.ticker = stock.ticker_full;
                analysis.market = stock.market;
                results.push(analysis);
            }
        }

        results.sort((a, b) => b.score - a.score);
        console.log(`Analyzed ${results.length} stocks. Top score: ${results[0]?.score}`);

        const today = new Date().toISOString().split('T')[0];
        const keys = [cacheKey, 'shariah_top300_real', 'shariah_top300_hybrid'];

        for (const key of keys) {
            await supabase.from('screener_results_cache').delete().eq('as_of_date', today).eq('universe', key);
            await supabase.from('screener_results_cache').insert({
                as_of_date: today,
                results_json: results,
                min_score: 0,
                universe: key
            });
        }

        console.log("Cache updated successfully!");
    } catch (err) {
        console.error("Compute error:", err);
    }
}
compute();
