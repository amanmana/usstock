require('dotenv').config();
const { handler } = require('./netlify/functions/computeScreener.js');

async function run() {
    console.log("Running compute screener locally...");
    const res = await handler({ queryStringParameters: { useMock: 'false' } }, {});
    console.log("RESPONSE:", res);
}

run();
