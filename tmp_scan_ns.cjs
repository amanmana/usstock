const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');

const env = fs.readFileSync('./.env', 'utf-8');
env.split('\n').forEach(line => {
    if (line && line.includes('=')) {
        const [key, ...rest] = line.split('=');
        process.env[key.trim()] = rest.join('=').trim();
    }
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function scan() {
    const { data: stocks, error } = await supabase
        .from('klse_stocks')
        .select('ticker_full, ticker_code, short_name, company_name')
        .eq('market', 'MYR')
        .eq('is_top300', true);

    if (error) throw error;

    // We only check ones that we haven't checked or might have failed
    console.log(`Verifying remaining ${stocks.length} stocks for Shariah compliance via iSaham...`);

    const nonShariah = [];
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

    for (const stock of stocks) {
        let name = stock.short_name;
        let success = false;
        let attempts = 0;

        while (!success && attempts < 3) {
            try {
                // Try short_name first, then try ticker code
                const q = attempts === 0 ? encodeURIComponent(name) : stock.ticker_code;
                const url = `https://www.isaham.my/stock/${q}`;

                const res = await axios.get(url, { headers, validateStatus: false, timeout: 10000 });

                if (res.status === 200) {
                    success = true;
                    if (res.data.includes('[NS]')) {
                        nonShariah.push(stock.ticker_full);
                        process.stdout.write(`\n❌ NS: ${stock.short_name} `);
                    } else if (res.data.includes('Syariah')) {
                        // Ensure it really loaded the page
                        process.stdout.write('.');
                    } else {
                        // Probably didn't load the real page or it's empty
                        process.stdout.write('o');
                    }
                } else if (res.status === 404) {
                    process.stdout.write(`?`);
                    attempts++;
                } else if (res.status === 403) {
                    process.stdout.write(`B`); // Blocked
                    attempts++;
                    await new Promise(r => setTimeout(r, 2000)); // Pause
                } else {
                    process.stdout.write(`${res.status}`);
                    attempts++;
                }
            } catch (e) {
                process.stdout.write('E');
                attempts++;
            }
            if (!success) await new Promise(r => setTimeout(r, 1000));
        }

        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n\nFound ${nonShariah.length} Non-Shariah stocks in this pass.`);

    if (nonShariah.length > 0) {
        const { error: dbErr } = await supabase
            .from('klse_stocks')
            .update({ shariah_status: 'NON-SHARIAH', is_top300: false })
            .in('ticker_full', nonShariah);
        if (dbErr) console.error("DB error:", dbErr);
        else console.log('Successfully updated non-shariah stocks in DB.');
    }
}

scan();
