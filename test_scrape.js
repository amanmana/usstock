import { fetchStockData } from './netlify/functions/utils/scraper.js';

async function test() {
    try {
        const ticker = 'AAPL'; // Test with a liquid US Stock
        console.log(`Fetching data for ${ticker}...`);
        const data = await fetchStockData(ticker);

        if (data) {
            console.log('Success! Data fetched:');
            console.log(JSON.stringify(data, null, 2));

            if (data.open && data.high && data.low && data.close) {
                console.log('✅ OHLC data present');
            } else {
                console.log('❌ Missing OHLC data');
            }
        } else {
            console.log('❌ Failed to fetch data');
        }
    } catch (err) {
        console.error('Test Error:', err);
    }
}

test();
