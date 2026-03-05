
const fs = require('fs');

const dataStr = fs.readFileSync('/Users/akhmal/.gemini/antigravity/brain/eb9f3c0b-9add-49d5-aa5f-c88d2989ae93/.system_generated/steps/1732/output.txt', 'utf8');
const data = JSON.parse(dataStr);
const prices = JSON.parse(data.result.match(/<untrusted-data-[^>]+>\n([\s\S]+?)\n<\/untrusted-data-/)[1]);

const batches = [];
const batchSize = 1000;

for (let i = 0; i < prices.length; i += batchSize) {
    const chunk = prices.slice(i, i + batchSize);
    const sqlHeader = "INSERT INTO klse_prices_daily (ticker_full, price_date, open, high, low, close, volume, source) VALUES ";
    const values = chunk.map(p => {
        return `('${p.ticker_full}', '${p.price_date}', ${p.open || 0}, ${p.high || 0}, ${p.low || 0}, ${p.close || 0}, ${p.volume || 0}, 'migration_from_screener')`;
    }).join(",\n");
    const sql = sqlHeader + values + " ON CONFLICT (ticker_full, price_date) DO NOTHING;";
    batches.push(sql);
}

fs.writeFileSync('/Applications/MAMP/htdocs/usstock/migrate_prices.sql', batches.join("\n\n-- BATCH --\n\n"));
console.log('SQL generated at /Applications/MAMP/htdocs/usstock/migrate_prices.sql');
