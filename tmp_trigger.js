import 'dotenv/config';
import { handler } from './netlify/functions/computeScreener.js';

async function run() {
    console.log("Running compute screener locally...");
    const res = await handler({ queryStringParameters: { useMock: 'false' } }, {});
    console.log("RESPONSE:", res);
}

run();
