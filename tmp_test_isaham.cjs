const axios = require('axios');

async function testISaham(symbol) {
    try {
        const res = await axios.get(`https://www.isaham.my/stock/${symbol}`);
        const html = res.data;
        const isNS = html.includes('[NS]');

        // Let's also extract the full title exactly 
        const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const title = match ? match[1].trim() : 'Title not found';

        console.log(`${symbol} -> isNS: ${isNS}, Title: ${title}`);
    } catch (e) {
        console.error(`${symbol} -> Error: ${e.message}`);
    }
}

testISaham('MAYBANK');
testISaham('TENAGA');
testISaham('1155');
testISaham('5347');
