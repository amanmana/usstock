import { supabase } from './utils/supabaseClient.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Syncs the local klse_stocks table with S&P 500 components.
 * Retrieves the list from Wikipedia.
 */
export const handler = async (event) => {
    try {
        const url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';
        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Shariah Whitelist based on SPUS & HLAL Holdings (Top major companies)
        // Strictly removing Financials, Tobacco, Alcohol, Gambling, and Non-Compliant Food/Hospitality.
        const shariahWhitelist = new Set([
            // Technology
            'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AVGO', 'ADBE', 'CRM', 'AMD', 'TXN',
            'CSCO', 'ORCL', 'NFLX', 'QCOM', 'INTC', 'MU', 'AMAT', 'LRCX', 'ADI', 'PANW',
            'SNPS', 'CDNS', 'KLAC', 'ASML', 'TEAM', 'WDAY', 'NOW', 'MCHP', 'ON', 'STX',
            'WDC', 'TER', 'ENTG', 'ANSS', 'CRWD', 'OKTA', 'ZS', 'DDOG', 'MDB', 'NET',
            'FSLY', 'AKAM', 'ANET', 'FSLR', 'ENPH', 'SEDG',

            // Health Care
            'LLY', 'JNJ', 'MRK', 'PFE', 'ABBV', 'ABT', 'TMO', 'DHR', 'AMGN', 'ISRG',
            'VRTX', 'REGN', 'BMY', 'GILD', 'ZTS', 'IDXX', 'ALGN', 'BSX', 'SYK', 'EW',
            'BAX', 'BDX', 'RMD', 'STE', 'IQV', 'A', 'MTD', 'WAT', 'VTRS', 'HCA',

            // Consumer Discretionary (Selective)
            'TSLA', 'AMZN', 'NKE', 'TJX', 'ORLY', 'AZO', 'ROST', 'LOW', 'HD', 'EBAY',
            'BKNG', 'ETSY', 'LULU', 'PHM', 'TSCO', 'POOL', 'HAS',

            // Communication Services
            'META', 'GOOG', 'GOOGL', 'NFLX', 'TMUS', 'VZ', 'T', 'CHTR', 'PARA', 'WBD',

            // Industrials
            'UPS', 'CAT', 'HON', 'GE', 'DE', 'LMT', 'RTX', 'BA', 'MMM', 'FAST',
            'CPRT', 'CSX', 'NSC', 'UNP', 'FDX', 'WM', 'RSG', 'EMR', 'ITW', 'ETN',
            'PH', 'PCAR', 'ADSK', 'TDG', 'AME', 'ROK', 'DOV', 'XYL', 'GWW',

            // Energy
            'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'VLO', 'PSX', 'PXD', 'OXY',
            'HAL', 'DVN', 'HES', 'APA', 'FANG', 'MRO',

            // Materials
            'LIN', 'APD', 'SHW', 'ECL', 'NEM', 'FCX', 'DD', 'ALB', 'MLM', 'VMC',
            'NUE', 'CTVA', 'FMC', 'IFF',

            // Utilities
            'NEE', 'DUK', 'SO', 'D', 'AEP', 'SRE', 'ED', 'PEG', 'EXC', 'XEL',
            'WEC', 'ES', 'AWK', 'AEE', 'FE', 'ETR', 'CMS', 'ATO', 'LNT', 'NI',

            // Real Estate (REITs - Shariah compliant only)
            'PLD', 'AMT', 'CCI', 'EQIX', 'PSA', 'DRE', 'EXR', 'VICI', 'WY', 'SBAC',
            'CBRE'
        ]);

        const $ = cheerio.load(html);
        const upserts = [];

        // Fetch stocks with manual Shariah corrections to avoid overwriting them
        const { data: manualCorrections } = await supabase
            .from('klse_stocks')
            .select('ticker_full')
            .eq('manual_shariah_correction', true);

        const manualSet = new Set(manualCorrections?.map(m => m.ticker_full) || []);

        // Parse the first table containing the S&P 500 companies
        $('#constituents tbody tr').each((index, element) => {
            if (index === 0) return; // Skip header

            const tds = $(element).find('td');
            if (tds.length >= 2) {
                // Ticker symbols (e.g. BRK.B needs to be BRK-B for Yahoo Finance)
                let ticker = $(tds[0]).text().trim().replace('.', '-');
                const name = $(tds[1]).text().trim();
                const sector = $(tds[3]).text().trim();

                const isShariah = shariahWhitelist.has(ticker);

                // For this project, we ONLY process and keep active the Shariah stocks
                // ALSO skip if user has manually corrected this stock
                if (isShariah && !manualSet.has(ticker)) {
                    upserts.push({
                        ticker_full: ticker,
                        ticker_code: ticker,
                        company_name: name,
                        short_name: ticker,
                        sector: sector,
                        market: 'US-SP500',
                        shariah_status: 'SHARIAH',
                        is_active: true,
                        is_top300: true, // Mark as part of the core universe
                        source_origin: 'wikipedia_sp500_shariah_whitelist'
                    });
                }
            }
        });

        if (upserts.length === 0) {
            throw new Error("Could not parse any stocks from Wikipedia.");
        }

        // Batch upsert to Supabase
        const chunkSize = 100;
        let successCount = 0;

        for (let i = 0; i < upserts.length; i += chunkSize) {
            const chunk = upserts.slice(i, i + chunkSize);
            const { error } = await supabase
                .from('klse_stocks')
                .upsert(chunk, {
                    onConflict: 'ticker_full',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error("Chunk error:", error);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "Supabase Error: " + error.message, details: error })
                };
            } else {
                successCount += chunk.length;

                // Proactively import history for these new Shariah stocks if they don't have enough data
                // To avoid timeout, we only do this for the first few or use a background pattern.
                // For now, let's just log and rely on the user or a separate backfill job for the full list.
                console.log(`Successfully upserted ${chunk.length} stocks. Ready for backfill.`);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                totalProcessed: successCount,
                message: "Sync complete with S&P 500 components list"
            })
        };

    } catch (err) {
        console.error("Sync error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
