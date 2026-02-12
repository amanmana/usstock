import { supabase } from './utils/supabaseClient';
import axios from 'axios';

/**
 * Syncs the local klse_stocks table with The Star's stock lookup JSON.
 * High quality source for names and numeric codes.
 */
export const handler = async (event) => {
    // Only allow manual trigger or scheduled
    try {
        const url = 'https://s3-ap-southeast-1.amazonaws.com/biz.thestar.com.my/json/stocklookup.js';
        const { data: rawJs } = await axios.get(url);

        // The file is "var stockdata = { ... };"
        // We use a regex to extract the JSON object part properly
        const startBracket = rawJs.indexOf('{');
        const endBracket = rawJs.lastIndexOf('}');

        if (startBracket === -1 || endBracket === -1) {
            throw new Error("Could not find JSON object in script");
        }

        let jsonStr = rawJs.substring(startBracket, endBracket + 1);
        // Remove trailing commas which are invalid in JSON.parse
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
        const stockData = JSON.parse(jsonStr);

        let addedCount = 0;
        let updatedCount = 0;

        // Entries are like "5209": "GAS MALAYSIA BERHAD - (5209) (GASMSIA)"
        // or "5347": "TENAGA NASIONAL BHD - (5347) (TENAGA)"
        // or "01389S": "ZETRIX-C9S: CW ZETRIX AI BERHAD (KIBB) - (01389S) (ZETRIX-C9S)"

        const upserts = [];

        for (const [code, desc] of Object.entries(stockData)) {
            // Filter out warrants/structured products for now if they look like warrants
            // Warrants usually have "CW", "PW", or "WARRANTS" in the description
            const isWarrant = desc.includes(' CW ') || desc.includes(' PW ') || desc.includes(' WARRANTS ') || desc.includes(' WARRANT ');

            // Extract ticker symbol (the one in the second parenthesis)
            // Example: "TENAGA NASIONAL BHD - (5347) (TENAGA)" -> TENAGA
            const match = desc.match(/\(([^)]+)\)\s*\(([^)]+)\)$/);
            let tickerSymbol = code; // Default to Numeric code
            let companyName = desc.split(' - ')[0].trim();

            if (match) {
                tickerSymbol = match[2]; // e.g. "TENAGA"
            }

            // We prefer the Numeric Code for Yahoo Finance reliability in Malaysia
            // Ticker full: "5347.KL"
            const tickerFull = `${code}.KL`;

            upserts.push({
                ticker_full: tickerFull,
                ticker_code: code,
                company_name: companyName,
                short_name: tickerSymbol,
                is_active: true,
                source_origin: 'thestar',
                // Keep existing values if they exist
                market: isWarrant ? 'Warrant' : 'Main/ACE'
            });
        }

        // Batch upsert to Supabase
        // We use onConflict 'ticker_full'
        const chunkSize = 100;
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
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                totalProcessed: Object.keys(stockData).length,
                message: "Sync complete with The Star Business master list"
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
