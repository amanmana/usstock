
const fs = require('fs');

const dataStr = fs.readFileSync('/Users/akhmal/.gemini/antigravity/brain/eb9f3c0b-9add-49d5-aa5f-c88d2989ae93/.system_generated/steps/1560/output.txt', 'utf8');
const data = JSON.parse(dataStr);
const stocks = JSON.parse(data.result.match(/<untrusted-data-[^>]+>\n([\s\S]+?)\n<\/untrusted-data-/)[1]);

const sqlHeader = "INSERT INTO klse_stocks (ticker_full, ticker_code, company_name, shariah_status, sector, market, is_active, is_top300, short_name, source_origin) VALUES ";
const values = stocks.map(s => {
    const ticker_full = s.ticker_full.replace(/'/g, "''");
    const ticker_code = s.ticker_code.replace(/'/g, "''");
    const company_name = s.company_name.replace(/'/g, "''");
    const shariah_status = s.shariah_status ? `'${s.shariah_status.replace(/'/g, "''")}'` : 'NULL';
    const sector = s.sector ? `'${s.sector.replace(/'/g, "''")}'` : 'NULL';
    const market = 'MYR';
    const short_name = s.short_name ? `'${s.short_name.replace(/'/g, "''")}'` : 'NULL';

    return `('${ticker_full}', '${ticker_code}', '${company_name}', ${shariah_status}, ${sector}, '${market}', true, true, ${short_name}, 'migration_from_screener')`;
}).join(",\n");

const sql = sqlHeader + values + " ON CONFLICT (ticker_full) DO UPDATE SET is_top300 = true, market = 'MYR', updated_at = now();";

fs.writeFileSync('/Applications/MAMP/htdocs/usstock/migrate_bursa.sql', sql);
console.log('SQL generated at /Applications/MAMP/htdocs/usstock/migrate_bursa.sql');
