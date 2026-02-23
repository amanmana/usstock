import { supabase } from './utils/supabaseClient.js';
import { analyzeStock } from './utils/indicators.js';
import { fetchStockData } from './utils/scraper.js';
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

        // 1. Get all tickers with any alert enabled
        const { data: monitored, error: fetchErr } = await supabase
            .from('favourites')
            .select('*')
            .eq('is_active', true)
            .or('alert_go.eq.true,alert_tp.eq.true,alert_sl.eq.true');

        if (fetchErr) throw fetchErr;
        if (!monitored || monitored.length === 0) {
            console.log('No monitored stocks with alerts enabled.');
            return { statusCode: 200, body: 'No monitored stocks.' };
        }

        // 2. Get all active positions for TP/SL checking
        const { data: positions } = await supabase.from('trading_positions').select('*');
        const posMap = {};
        if (positions) {
            positions.forEach(p => { posMap[p.ticker_full] = p; });
        }

        console.log(`Checking alerts for ${monitored.length} stocks...`);

        for (const item of monitored) {
            try {
                const ticker = item.ticker_full;
                const pos = posMap[ticker];

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

                // Scrub latest data
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

                if (liveData && liveData.close) {
                    const lastIdx = priceData.length - 1;
                    if (priceData[lastIdx].date === liveData.priceDate) {
                        priceData[lastIdx].close = liveData.close;
                    } else {
                        priceData.push({ close: liveData.close, volume: liveData.volume, date: liveData.priceDate });
                    }
                }

                const currentPrice = priceData[priceData.length - 1].close;

                // 3. Run Technical Analysis
                const result = analyzeStock({
                    code: ticker.split('.')[0],
                    company: ticker.split('.')[0],
                    prices: priceData
                });

                if (!result) continue;

                // 4. Alert Logic
                const score = Math.max(result.score, result.momentumScore);
                const rr = result.levels?.rr1 || 0;
                let currentVerdict = "NEUTRAL";
                if (score < 5.0) currentVerdict = "AVOID";
                else if (score >= 7.0) {
                    if (rr >= 2.0) currentVerdict = "GO";
                    else currentVerdict = "WAIT";
                }

                // --- SIGNAL GO ALERT ---
                if (item.alert_go && currentVerdict === "GO" && item.last_alert_status !== "GO") {
                    console.log(`ALERT: ${ticker} hit GO!`);
                    const message = `🚀 *SIGNAL GO: ${ticker}*\n\n` +
                        `💹 *Price*: RM ${currentPrice.toFixed(3)}\n` +
                        `🎯 *Target*: RM ${result.levels.target1.toFixed(3)}\n` +
                        `🛡️ *Stop*: RM ${result.levels.stopPrice.toFixed(3)}\n` +
                        `📊 *Score*: ${score.toFixed(1)}\n` +
                        `⚖️ *RR Ratio*: ${rr.toFixed(2)}\n\n` +
                        `🔗 [View Screener](${process.env.URL || 'https://bursa-rebound-screener.netlify.app'})`;

                    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: chatId, text: message, parse_mode: 'Markdown' });
                }

                // --- TARGET PRICE (TP) ALERT ---
                if (item.alert_tp && pos && pos.target_price > 0 && currentPrice >= pos.target_price) {
                    // Only alert if we haven't alerted for this price yet (or if price has reset)
                    if (item.last_tp_price !== currentPrice) {
                        console.log(`ALERT: ${ticker} hit TP!`);
                        const pl = ((currentPrice - pos.entry_price) / pos.entry_price * 100).toFixed(2);
                        const message = `🎯 *TARGET REACHED (TP): ${ticker}*\n\n` +
                            `💰 *Sell Price*: RM ${currentPrice.toFixed(3)}\n` +
                            `📈 *Profit*: +${pl}%\n` +
                            `📝 *Plan*: Target RM ${pos.target_price.toFixed(3)}\n\n` +
                            `🎉 Masa yang tepat untuk tuai hasil!`;

                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: chatId, text: message, parse_mode: 'Markdown' });
                        await supabase.from('favourites').update({ last_tp_price: currentPrice }).eq('ticker_full', ticker);
                    }
                }

                // --- STOP LOSS (SL) ALERT ---
                if (item.alert_sl && pos && pos.stop_loss > 0 && currentPrice <= pos.stop_loss) {
                    if (item.last_sl_price !== currentPrice) {
                        console.log(`ALERT: ${ticker} hit SL!`);
                        const pl = ((currentPrice - pos.entry_price) / pos.entry_price * 100).toFixed(2);
                        const message = `🛡️ *STOP LOSS HIT: ${ticker}*\n\n` +
                            `🚨 *Price*: RM ${currentPrice.toFixed(3)}\n` +
                            `📉 *Loss*: ${pl}%\n` +
                            `📝 *Plan*: SL RM ${pos.stop_loss.toFixed(3)}\n\n` +
                            `⚠️ Disiplin adalah kunci. Kawal risiko anda.`;

                        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: chatId, text: message, parse_mode: 'Markdown' });
                        await supabase.from('favourites').update({ last_sl_price: currentPrice }).eq('ticker_full', ticker);
                    }
                }

                // Update last_alert_status
                if (currentVerdict !== item.last_alert_status) {
                    await supabase.from('favourites').update({ last_alert_status: currentVerdict }).eq('ticker_full', ticker);
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
