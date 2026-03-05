const fs = require('fs');
const path = require('path');

const inputPath = '/Users/akhmal/.gemini/antigravity/brain/eb9f3c0b-9add-49d5-aa5f-c88d2989ae93/.system_generated/steps/1796/output.txt';
const outputPath = '/Applications/MAMP/htdocs/usstock/bursa_ohlcv_batches.sql';

try {
    const rawData = fs.readFileSync(inputPath, 'utf8');
    const outerObj = JSON.parse(rawData);
    const resultText = outerObj.result;

    const startMarker = '<untrusted-data-9c9c4cf8-f44b-409e-8869-9e07819731cc>\n';
    const endMarker = '\n</untrusted-data-9c9c4cf8-f44b-409e-8869-9e07819731cc>';

    const startIndex = resultText.indexOf(startMarker);
    const endIndex = resultText.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) {
        console.error("Could not find boundaries in result text.");
        process.exit(1);
    } else {
        const jsonStr = resultText.substring(startIndex + startMarker.length, endIndex);
        processRecords(JSON.parse(jsonStr));
    }

    function processRecords(records) {
        console.log(`Processing ${records.length} records...`);

        const BATCH_SIZE = 400; // Smaller batches for complex query
        let allSqlBatches = [];

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);

            // Constructing a CTE of values and joining with klse_stocks
            let sql = `INSERT INTO klse_prices_daily (ticker_full, price_date, open, high, low, close, volume, source)\n`;
            sql += `SELECT v.ticker_full, v.price_date, v.open, v.high, v.low, v.close, v.volume, v.source\n`;
            sql += `FROM (VALUES\n`;

            const rows = batch.map(r => {
                const open = (r.open === null || r.open === undefined) ? 'NULL' : r.open;
                const high = (r.high === null || r.high === undefined) ? 'NULL' : r.high;
                const low = (r.low === null || r.low === undefined) ? 'NULL' : r.low;
                const volume = (r.volume === null || r.volume === undefined) ? 0 : r.volume;
                const close = (r.close === null || r.close === undefined) ? 0 : r.close;
                return `('${r.ticker_full}', '${r.price_date}'::date, ${open}::numeric, ${high}::numeric, ${low}::numeric, ${close}::numeric, ${volume}::bigint, 'direct_migration')`;
            });

            sql += rows.join(',\n');
            sql += `\n) AS v(ticker_full, price_date, open, high, low, close, volume, source)\n`;
            sql += `JOIN klse_stocks s ON v.ticker_full = s.ticker_full\n`;
            sql += `ON CONFLICT (ticker_full, price_date) DO UPDATE SET \n`;
            sql += `open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close, volume = EXCLUDED.volume;`;

            allSqlBatches.push(sql);
        }

        fs.writeFileSync(outputPath, allSqlBatches.join('\n\n-- BATCH_SEPARATOR --\n\n'));
        console.log(`Generated ${allSqlBatches.length} filtered batches in ${outputPath}`);
    }
} catch (e) {
    console.error("Error processing file:", e);
}
