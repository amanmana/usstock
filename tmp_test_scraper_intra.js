import { fetchIntradayData } from './netlify/functions/utils/scraper.js';

async function test() {
    const data15m = await fetchIntradayData('5186.KL', '15m', '1mo');
    const dataHourly = await fetchIntradayData('5186.KL', '60m', '1mo');

    console.log("15m length:", data15m?.length);
    console.log("60m length:", dataHourly?.length);
}

test().catch(console.error);
