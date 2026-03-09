export const handler = async (event) => {
    const company = "POH KONG HOLDINGS BHD";
    const ticker = "5080.KL";
    const currency = "RM";
    const currentPrice = 1.210;
    const target = 1.270;
    const stop = 1.168;
    const score = 8.2;
    const rr = 2.15;

    const message = `🚀 *SIGNAL GO: ${company} (${ticker})*\n\n` +
        `💹 *Price*: ${currency} ${currentPrice.toFixed(3)}\n` +
        `🎯 *Target*: ${currency} ${target.toFixed(3)}\n` +
        `🛡️ *Stop*: ${currency} ${stop.toFixed(3)}\n` +
        `📊 *Score*: ${score.toFixed(1)}\n` +
        `⚖️ *RR Ratio*: ${rr.toFixed(2)}\n\n` +
        `💡 _Ini adalah lakaran (sample) format baru._\n` +
        `🔗 [View Screener](https://usstock.netlify.app)`;

    return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
        body: message
    };
};
