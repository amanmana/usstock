import { supabase } from './utils/supabaseClient';
import { analyzeStock } from './utils/indicators';
import { fetchStockData } from './utils/scraper';
import axios from 'axios';

export const handler = async (event) => {
    console.log('Running Telegram Alert Worker...');

    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
            console.error('Missing Telegram Credentials');
            return { statusCode: 500, body: 'Missing Telegram Credentials' };
        }

        // 1. Get all tickers with alerts enabled
        const { data: monitored, error: fetchErr } = await supabase
            .from('favourites')
            .select('*')
            .eq('alert_enabled', true)
            .eq('is_active', true);

        if (fetchErr) throw fetchErr;
        if (!monitored || monitored.length === 0) {
            console.log('No monitored stocks with alerts enabled.');
            return { statusCode: 200, body: 'No monitored stocks.' };
        }

        console.log(`Checking alerts for ${monitored.length} stocks...`);

        for (const item of monitored) {
            try {
                const ticker = item.ticker_full;

                // 2. Fetch Latest Price & History
                const limitDate = new Date();
                limitDate.setFullYear(limitDate.getFullYear() - 1);

                const { data: prices } = await supabase
                    .from('klse_prices_daily')
                    .select('close, volume, price_date')
                    .eq('ticker_full', ticker)
                    .gte('price_date', limitDate.toISOString())
                    .order('price_date', { ascending: true });

                if (!prices || prices.length < 5) continue;

                // Scrub latest data to ensure we have fresh price
                let liveData = null;
                try {
                    liveData = await fetchStockData(ticker.split('.')[0]);
                } catch (e) {
                    console.warn(`Scraper failed for ${ticker}, using db price.`);
                }

                const priceData = prices.map(p => ({
                    close: p.close,
                    volume: p.volume,
                    date: p.price_date
                }));

                // Injection live price if exists
                if (liveData && liveData.close) {
                    const lastIdx = priceData.length - 1;
                    if (priceData[lastIdx].date === liveData.priceDate) {
                        priceData[lastIdx].close = liveData.close;
                        priceData[lastIdx].volume = liveData.volume;
                    } else {
                        priceData.push({
                            close: liveData.close,
                            volume: liveData.volume,
                            date: liveData.priceDate
                        });
                    }
                }

                // 3. Run Analysis
                const result = analyzeStock({
                    code: ticker.split('.')[0],
                    company: ticker.split('.')[0], // Placeholder
                    prices: priceData
                });

                if (!result) continue;

                // 4. Decision Verdict Logic
                const score = Math.max(result.score, result.momentumScore);
                const rr = result.levels?.rr1 || 0;
                let currentVerdict = "NEUTRAL";

                if (score < 5.0) currentVerdict = "AVOID";
                else if (score >= 7.0) {
                    if (rr >= 2.0) currentVerdict = "GO";
                    else currentVerdict = "WAIT";
                }

                // 5. Check if we should alert
                // Alert if it just hit GO and wasn't GO before
                if (currentVerdict === "GO" && item.last_alert_status !== "GO") {
                    console.log(`ALERT: ${ticker} hit GO!`);

                    const message = `🚀 *SIGNAL GO: ${ticker}*\n\n` +
                        `💹 *Price*: RM ${result.close.toFixed(3)}\n` +
                        `🎯 *Target*: RM ${result.levels.target1.toFixed(3)}\n` +
                        `🛡️ *Stop*: RM ${result.levels.stopPrice.toFixed(3)}\n` +
                        `📊 *Score*: ${score.toFixed(1)} (${result.recommendedTab === 'momentum' ? 'Momentum' : 'Rebound'})\n` +
                        `⚖️ *RR Ratio*: ${rr.toFixed(2)}\n\n` +
                        `🔗 [View Screener](${process.env.URL || 'https://bursa-rebound-screener.netlify.app'})`;

                    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        chat_id: chatId,
                        text: message,
                        parse_mode: 'Markdown'
                    });
                }

                // Update last_alert_status if it changed
                if (currentVerdict !== item.last_alert_status) {
                    await supabase
                        .from('favourites')
                        .update({ last_alert_status: currentVerdict })
                        .eq('ticker_full', ticker);
                }

            } catch (err) {
                console.error(`Error processing ${item.ticker_full}:`, err);
            }
        }

        return { statusCode: 200, body: 'Alert check complete.' };

    } catch (err) {
        console.error('Alert Worker Failed:', err);
        return { statusCode: 500, body: err.message };
    }
};

export const config = {
    schedule: "*/30 1-9 * * 1-5" // Every 30 mins, 9am-5pm KL time (approx 1-9 UTC)
};
