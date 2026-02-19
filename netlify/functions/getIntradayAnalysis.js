import { fetchIntradayData } from './utils/scraper';
import { supabase } from './utils/supabaseClient';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };

    try {
        const body = JSON.parse(event.body);
        const { ticker, entryPrice } = body;

        if (!ticker) return { statusCode: 400, body: 'Missing ticker' };

        // 1. Fetch Data for different timeframes
        const [intraday, daily, weekly] = await Promise.all([
            fetchIntradayData(ticker, '15m', '5d'),
            fetchIntradayData(ticker, '1d', '3mo'),
            fetchIntradayData(ticker, '1wk', '1y')
        ]);

        if (!intraday || intraday.length < 4) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Insufficent intraday data.' })
            };
        }

        const now = intraday[intraday.length - 1];
        const currentPrice = now.close;

        // 2. MTF Analysis
        // 15m Trend (4h average)
        const last4h = intraday.slice(-16);
        const avg4h = last4h.reduce((acc, p) => acc + p.close, 0) / last4h.length;
        const trend15m = currentPrice > avg4h * 1.005 ? 'Bullish' : (currentPrice < avg4h * 0.995 ? 'Bearish' : 'Neutral');

        // Daily Trend (EMA20 approximation)
        const avg20d = daily ? daily.slice(-20).reduce((acc, p) => acc + p.close, 0) / Math.min(daily.length, 20) : currentPrice;
        const trend1d = currentPrice > avg20d * 1.01 ? 'Bullish' : (currentPrice < avg20d * 0.99 ? 'Bearish' : 'Neutral');

        // Weekly Trend (EMA20 Weekly approximation)
        const avg20w = weekly ? weekly.slice(-20).reduce((acc, p) => acc + p.close, 0) / Math.min(weekly.length, 20) : currentPrice;
        const trend1w = currentPrice > avg20w * 1.02 ? 'Bullish' : (currentPrice < avg20w * 0.98 ? 'Bearish' : 'Neutral');

        // Pullback & Rally Days Calculation
        let pullbackDays = 0;
        let rallyDays = 0;
        if (daily && daily.length > 1) {
            const last = daily[daily.length - 1];
            const prev = daily[daily.length - 2];

            if (last.close < prev.close) {
                // Consecutive lower closes
                for (let i = daily.length - 1; i > 0; i--) {
                    if (daily[i].close < daily[i - 1].close) pullbackDays++;
                    else break;
                }
            } else if (last.close > prev.close) {
                // Consecutive higher closes
                for (let i = daily.length - 1; i > 0; i--) {
                    if (daily[i].close > daily[i - 1].close) rallyDays++;
                    else break;
                }
            }
        }

        const alignment = {
            m15: trend15m,
            d1: trend1d,
            w1: trend1w,
            pullbackDays,
            rallyDays
        };

        const scoreMTF = (trend15m === 'Bullish' ? 1 : 0) + (trend1d === 'Bullish' ? 1 : 0) + (trend1w === 'Bullish' ? 1 : 0);

        // 3. Decision Advice
        let advice = "";
        let color = "text-blue-400";
        let type = "hold";

        if (entryPrice) {
            const pl = ((currentPrice - entryPrice) / entryPrice) * 100;

            if (scoreMTF === 3) {
                advice = `Keselarasan Trend SEMPURNA (3/3 Hijau). Harga berada di atas EMA Mingguan, Harian dan Intraday. Trend sangat kuat. Cadangan: Teruskan HOLD untuk keuntungan maksima.`;
                color = "text-emerald-400";
                type = "hold";
            } else if (trend15m === 'Bearish' && pl > 0) {
                advice = `Trend Intraday mula melemah walaupun Trend Besar (D/W) masih okey. Untung semasa +${pl.toFixed(1)}%. Cadangan: Ambil Untung Sebahagian (Lock Profit) jika harga bocor RM ${avg4h.toFixed(3)}.`;
                color = "text-orange-400";
                type = "tp";
            } else if (trend1d === 'Bearish' || trend1w === 'Bearish') {
                advice = `Trend Jangka Panjang lemah (D/W Bearish). Berwaspada, sebarang kenaikan intraday mungkin hanya teknikal rebound sementara.`;
                color = "text-red-400";
                type = "hold";
            } else {
                advice = `Trend ${trend15m}. Harga stabil. Kedudukan MTF: ${scoreMTF}/3 Hijau. Pantau paras RM ${avg4h.toFixed(3)}.`;
                color = "text-blue-400";
                type = "hold";
            }
        } else {
            advice = `MTF Alignment: 15m(${trend15m}), 1D(${trend1d}), 1W(${trend1w}). Status Keselarasan: ${scoreMTF}/3.`;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                ticker,
                currentPrice,
                alignment,
                scoreMTF,
                advice,
                adviceType: type,
                adviceColor: color,
                lastUpdated: now.date
            })
        };

    } catch (err) {
        console.error('Intraday Analysis Error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
