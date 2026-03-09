import axios from 'axios';

export const handler = async (event) => {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
            return { statusCode: 500, body: 'Missing Telegram Credentials' };
        }

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
            `💡 _Ini adalah mesej ujian format baru._\n` +
            `🔗 [View Screener](${process.env.URL || 'https://usstock.netlify.app'})`;

        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
        });

        return { statusCode: 200, body: 'Sample Alert Sent!' };

    } catch (err) {
        console.error('Test Alert Failed:', err);
        return { statusCode: 500, body: err.message };
    }
};
