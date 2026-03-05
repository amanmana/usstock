import { supabase } from './utils/supabaseClient.js';

const STAR_URL = 'https://s3-ap-southeast-1.amazonaws.com/biz.thestar.com.my/json/stocklookup.js';

/**
 * Syncs Bursa Malaysia stock master list from The Star's stocklookup.js.
 * Only imports MAIN stocks (not warrants, CW, ETF, bonds, etc.)
 * Run manually from the Bursa Dashboard or automatically.
 */
export const handler = async (event, context) => {
    try {
        // 1. Fetch the latest JS file from The Star
        const res = await fetch(STAR_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch Star stocklookup.js: ${res.status}`);
        }

        const text = await res.text();

        // 2. Use regex to extract all "key":"value" pairs directly.
        //    This is more robust than JSON.parse because the JS file may contain
        //    non-standard characters (e.g. unescaped & or special chars at deep positions).
        //    Pattern: "CODE":"DESCRIPTION"
        const pairRegex = /"([^"]+)":"([^"]+)"/g;
        const stockdata = {};
        let pm;
        while ((pm = pairRegex.exec(text)) !== null) {
            stockdata[pm[1]] = pm[2];
        }

        if (Object.keys(stockdata).length === 0) {
            throw new Error('Could not extract any entries from stocklookup.js');
        }

        // 3. Filter to MAIN BOARD stocks ONLY
        // Skip: Warrants (-W), Call Warrants (-C), Put Warrants (-H), ETFs (-EA, -EB),
        //        Bonds (-GB), ICPS (-PA, -PB, -PC), ICUS (-LA, -LC, -LE), RCPS
        // Keep: plain 4-digit codes or 4-char alphanumeric WITHOUT suffixes
        const SKIP_SUFFIXES = [
            '-W', 'WA', 'WB', 'WC', 'WD', 'WE', 'WF',           // Warrants
            '-C', 'CA', 'CB', 'CC', 'CD', 'CE', 'CF', 'CG', 'CH', 'CI', 'CJ', 'CK', 'CL', 'CM', 'CN', 'CO', 'CP', 'CQ', 'CR', 'CS', 'CT', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', // CW prefixes
            '-H', 'HA', 'HB', 'HC', 'HD', 'HE', 'HF', 'HG', 'HH', 'HI', 'HJ', // Put warrants
            'EA', 'EB',                         // ETFs
            'GB',                               // govt bonds
            'LA', 'LB', 'LC', 'LD', 'LE', 'LF',   // ICULS
            'PA', 'PB', 'PC',                   // Preference shares
            'SS',                               // Stapled securities
        ];

        // Patterns to exclude (warrants, CW, indices, foreign stocks)
        const COMPANY_EXCLUDE_PATTERNS = [
            /: CW /i,       // Calls/puts warrants bracket
            /: PW /i,       // Put warrants
            /WARRANTS?\s/i, // Warrant in name
            /WARRANTS$/i,
            /\bETF\b/,
            /INDEX FUND/i,
            /TRACKER\b/i,
            /ICULS/i,
            /ICPS/i,
            /RCPS/i,
            /IRREDEEMABLE CONVERTIBLE/i,
            /REDEEMABLE CONVERTIBLE/i,
            /PREFERENCE SHARES/i,
            /UNSECURED LOAN/i,
            /BOND INDEX/i,
            /ETBS/i,        // bond ETB
            /LEVERAGED ETF/i,
            /INVERSE ETF/i,
        ];

        const upserts = [];
        let skipped = 0;
        let added = 0;

        for (const [code, desc] of Object.entries(stockdata)) {
            // Skip entries that match company-level exclusion patterns
            if (COMPANY_EXCLUDE_PATTERNS.some(p => p.test(desc))) {
                skipped++;
                continue;
            }

            // Skip codes that are clearly not main-board (long codes with suffixes)
            // Main-board codes: 4 digits, or 4 digits + short suffix for some like "5235SS" (stapled)
            // Typical main board codes: "5347", "1155", "0078", "03011" (ACE market - 5 chars starting with 0)
            const codeLen = code.length;
            // Code must be 4-5 chars max and all digits (or start with 0 then digits)
            if (codeLen > 5) {
                skipped++;
                continue;
            }

            // Skip if code ends with known warrant/CW suffixes (after trimming digits)
            const codeSuffix = code.slice(-2).toUpperCase();
            const codeAlpha = code.replace(/\d/g, '');
            if (
                codeAlpha.length > 0 && // has letters
                SKIP_SUFFIXES.includes(codeSuffix)
            ) {
                skipped++;
                continue;
            }

            // Parse: "TENAGA NASIONAL BHD - (5347) (TENAGA)"
            // Pattern: "COMPANY NAME - (CODE) (TICKER)"
            // Sometimes: "COMPANY NAME - (CODE)"
            const descMatch = desc.match(/^(.+?)\s+-\s+\(([^)]+)\)\s+(?:\(([^)]+)\))?$/);
            if (!descMatch) {
                skipped++;
                continue;
            }

            const [, rawName, parsedCode, shortName] = descMatch;

            // Final check: reject if it still contains warrant/preference words
            if (/WARRANT|ICPS|ICULS|RCPS|PREFERENCE|CONVERTIBLE|LOAN STOCK|BOND|ETF|FUND|TRUST/i.test(rawName)) {
                skipped++;
                continue;
            }

            const companyName = rawName.trim();
            const tickerCode = parsedCode.trim();
            const tickerShort = shortName?.trim() || tickerCode;

            // Format ticker_full as "TICKERCODE.KL" for Yahoo Finance compatibility
            // This prevents duplicate entries with different alpha-based symbols.
            const tickerFull = `${tickerCode}.KL`;

            // Ticker Overrides for Stability
            const TICKER_OVERRIDES = {
                'MHB.KL': { tc: '5186', cn: 'MALAYSIA MARINE AND HEAVY ENG' },
                'KSL.KL': { tc: '5038', cn: 'KSL HOLDINGS BHD' }
            };

            const finalTickerCode = TICKER_OVERRIDES[tickerFull]?.tc || tickerCode;
            const finalCompanyName = TICKER_OVERRIDES[tickerFull]?.cn || companyName;

            if (tickerShort === 'MHB') {
                console.log('MHB Upsert Data:', { tickerFull, finalTickerCode, finalCompanyName });
            }

            upserts.push({
                ticker_full: tickerFull,
                ticker_code: finalTickerCode,
                company_name: finalCompanyName,
                short_name: tickerShort,
                market: 'MYR',
                is_active: true,
                source_origin: 'thestar_bursa_master',
                // Don't overwrite Shariah status if already set
            });

            added++;
        }

        if (upserts.length === 0) {
            throw new Error('No main-board stocks found after filtering');
        }

        // 4. Batch upsert into klse_stocks
        const chunkSize = 200;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < upserts.length; i += chunkSize) {
            const chunk = upserts.slice(i, i + chunkSize);
            const { error } = await supabase
                .from('klse_stocks')
                .upsert(chunk, {
                    onConflict: 'ticker_full',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error('Chunk upsert error:', error.message);
                errorCount += chunk.length;
            } else {
                successCount += chunk.length;
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                parsed: Object.keys(stockdata).length,
                added,
                skipped,
                upserted: successCount,
                errors: errorCount,
                message: `Bursa master sync complete. ${successCount} stocks upserted.`
            })
        };

    } catch (err) {
        console.error('syncBursaMaster error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
