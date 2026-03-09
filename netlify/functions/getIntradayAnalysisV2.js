import { fetchIntradayData, fetchStockData } from './utils/scraper.js';
import { supabase } from './utils/supabaseClient.js';
import { analyzeStock, computeHeikinAshi, computeStochastic } from './utils/indicators.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST required' };
    try {
        const body = JSON.parse(event.body);
        const { ticker, entryPrice, isOwned } = body;
        return {
            statusCode: 200,
            body: JSON.stringify(await analyzeIntraday(ticker, entryPrice, isOwned))
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};

export const analyzeIntraday = async (ticker, entryPrice, isOwned) => {
    try {
        // 1. Fetch DB Metadata to determine Yahoo Finance Symbol
        // First try exact match on ticker_full
        let { data: stockInfo } = await supabase
            .from('klse_stocks')
            .select('ticker_code, ticker_full, market, short_name')
            .eq('ticker_full', ticker)
            .maybeSingle();

        // Fallback: if not found by ticker_full, try matching by short_name
        // This handles cases like 'UZMA.KL' where DB stores it as '7250.KL'
        if (!stockInfo && ticker.endsWith('.KL')) {
            const shortCode = ticker.replace('.KL', '');
            const { data: fallbackInfo } = await supabase
                .from('klse_stocks')
                .select('ticker_code, ticker_full, market, short_name')
                .or(`short_name.eq.${shortCode},ticker_code.eq.${shortCode}`)
                .eq('market', 'MYR')
                .maybeSingle();

            if (fallbackInfo) {
                console.log(`[analyzeIntraday] Resolved ${ticker} -> ${fallbackInfo.ticker_full} via short_name fallback`);
                stockInfo = fallbackInfo;
            }
        }

        let yfSymbol = ticker;
        if (stockInfo && (stockInfo.market === 'MYR' || stockInfo.market === 'KLSE') && stockInfo.ticker_code) {
            yfSymbol = stockInfo.ticker_code.endsWith('.KL') ? stockInfo.ticker_code : `${stockInfo.ticker_code}.KL`;
        }

        // 2. Fetch Data for different timeframes
        const historyTicker = stockInfo?.ticker_full || ticker;
        const [intraday, hourly, dailyHistory, weekly, livePrice] = await Promise.all([
            fetchIntradayData(yfSymbol, '15m', '1mo'),
            fetchIntradayData(yfSymbol, '60m', '1mo'),
            supabase.from('klse_prices_daily').select('open, high, low, close, volume, price_date').eq('ticker_full', historyTicker).order('price_date', { ascending: true }).limit(250),
            fetchIntradayData(yfSymbol, '1wk', '1y'),
            fetchStockData(yfSymbol)
        ]);

        let daily = dailyHistory.data || [];

        // If daily from DB is empty, use Yahoo daily as fallback (important for US stocks if not yet in DB)
        if (daily.length === 0) {
            console.warn(`No daily history found in DB for ${ticker}, using 1d Yahoo fallback for ${yfSymbol}`);
            const fallbackDaily = await fetchIntradayData(yfSymbol, '1d', '1y');
            if (fallbackDaily) {
                daily = fallbackDaily.map(p => ({
                    open: p.open,
                    high: p.high,
                    low: p.low,
                    close: p.close,
                    volume: p.volume,
                    price_date: p.date
                }));
            }
        }

        const cleanData = (arr) => (arr || []).filter(p => p && p.close !== null).map(p => ({
            ...p,
            open: Number(p.open || p.close),
            high: Number(p.high || p.close || p.open),
            low: Number(p.low || p.close || p.open),
            close: Number(p.close),
            volume: Number(p.volume || 0),
            date: p.date || p.price_date
        })).filter(p => !isNaN(p.close));

        const candles15m = cleanData(intraday);
        const candles1h = cleanData(hourly);
        const candlesDaily = cleanData(daily);

        const latestDaily = candlesDaily.length > 0 ? candlesDaily[candlesDaily.length - 1] : null;

        // Determine current price with multiple fallbacks
        let currentPrice = Number(livePrice?.close ||
            (candles15m.length > 0 ? candles15m[candles15m.length - 1].close : 0) ||
            (latestDaily?.close || 0));

        // Helper: Calculate EMA
        const getEMA = (data, period) => {
            if (data.length < period) return null;
            const k = 2 / (period + 1);
            let ema = data[0].close;
            for (let i = 1; i < data.length; i++) {
                ema = data[i].close * k + ema * (1 - k);
            }
            return ema;
        };

        // Helper to determine trend by combining EMA and HA
        const getTrend = (currentPrice, ema, prevCandle, haPrices) => {
            if (!ema || !haPrices || haPrices.length === 0) return 'Unknown';

            const isEMABullish = currentPrice > ema || (prevCandle && currentPrice > (prevCandle.high || prevCandle.close));
            const isEMABearish = currentPrice < ema * 0.995;

            const lastHA = haPrices[haPrices.length - 1];
            const isHABullish = lastHA ? lastHA.close > lastHA.open : false;
            const isHABearish = lastHA ? lastHA.close < lastHA.open : false;

            if (isEMABullish && isHABullish) return 'Bullish';
            if (isEMABearish && isHABearish) return 'Bearish';
            return 'Neutral';
        };

        // MTF Timeframes: 15M, 1H, 4H
        let trend15m = 'Unknown';
        if (candles15m.length >= 4) {
            const haP15m = computeHeikinAshi(candles15m);
            const ema20_15m = getEMA(candles15m, 20);
            trend15m = getTrend(currentPrice, ema20_15m, candles15m[candles15m.length - 2], haP15m);
        }

        let trend1h = 'Unknown';
        if (candles1h.length >= 4) {
            const haP1h = computeHeikinAshi(candles1h);
            const ema20_1h = getEMA(candles1h, 20);
            trend1h = getTrend(currentPrice, ema20_1h, candles1h[candles1h.length - 2], haP1h);
        }

        let trend4h = 'Unknown';
        let ha4h = { status: 'WAIT', reason: 'Tiada Data' };
        const candles4hArr = [];
        if (candles1h.length >= 4) {
            for (let i = 0; i < candles1h.length; i += 4) {
                const chunk = candles1h.slice(i, i + 4);
                if (chunk.length === 0) continue;
                candles4hArr.push({
                    open: chunk[0].open || chunk[0].close,
                    high: Math.max(...chunk.map(c => c.high || c.close)),
                    low: Math.min(...chunk.map(c => c.low || c.close)),
                    close: chunk[chunk.length - 1].close,
                    date: chunk[chunk.length - 1].date
                });
            }
            if (candles4hArr.length >= 3) {
                const haPrices = computeHeikinAshi(candles4hArr);
                const ema20_4h = getEMA(candles4hArr, 20);
                trend4h = getTrend(currentPrice, ema20_4h, candles4hArr[candles4hArr.length - 2], haPrices);

                // Detailed HA 4H logic
                const haToday = haPrices[haPrices.length - 1];
                const haPrev = haPrices[haPrices.length - 2];
                const isGreen = haToday.close > haToday.open;
                const prevGreen = haPrev.close > haPrev.open;

                if (isGreen) {
                    ha4h = {
                        status: 'GO',
                        reason: prevGreen ? 'Confirm Bullish' : 'Reversal Hijau',
                        isConfirmed: prevGreen
                    };
                } else {
                    ha4h = { status: 'SELL', reason: 'Lilin HA Merah' };
                }
            }
        }

        // Calculate Pullback & Rally Days
        let pullbackDays = 0;
        let rallyDays = 0;
        if (candlesDaily.length > 1) {
            const last = candlesDaily[candlesDaily.length - 1];
            const prev = candlesDaily[candlesDaily.length - 2];

            if (last.close < prev.close) {
                for (let i = candlesDaily.length - 1; i > 0; i--) {
                    if (candlesDaily[i].close < candlesDaily[i - 1].close) pullbackDays++;
                    else break;
                }
            } else if (last.close > prev.close) {
                for (let i = candlesDaily.length - 1; i > 0; i--) {
                    if (candlesDaily[i].close > candlesDaily[i - 1].close) rallyDays++;
                    else break;
                }
            }
        }

        const alignment = {
            m15: trend15m,
            h1: trend1h,
            h4: trend4h,
            pullbackDays: pullbackDays || 0,
            rallyDays: rallyDays || 0
        };

        // Calculate scoreMTF based on available trends
        const trends = [trend15m, trend1h, trend4h].filter(t => t !== 'Unknown');
        const scoreMTF = trends.filter(t => t === 'Bullish').length;
        const totalCount = trends.length;

        // Advice Logic
        let advice = "Menganalisa data pasaran...";
        let color = "text-indigo-400";
        let type = "hold";

        if (totalCount === 0) {
            advice = "DATA TERHAD: Tidak cukup data intraday untuk analisa momentum pendek. Rujuk indikator harian.";
        } else if (scoreMTF === totalCount && totalCount >= 2) {
            advice = isOwned
                ? `TERUSKAN HOLD: Momentum Intraday sangat kuat (${scoreMTF}/${totalCount} Bullish). Biarkan keuntungan anda berkembang (Maximize Profit). Pantau Trailing Stop.`
                : `SIGNAL GO: Momentum ${scoreMTF}/${totalCount} Bullish sempurna. Harga di atas semua EMA intraday utama. Cadangan: BELI / TAMBAH UNIT.`;
            color = "text-emerald-400";
        } else if (scoreMTF >= Math.ceil(totalCount / 2) && totalCount > 0) {
            advice = isOwned
                ? `KEKAL PEGANG: Trend intraday masih terkawal (${scoreMTF}/${totalCount} Bullish). Tiada isyarat keluar (Exit) buat masa ini.`
                : `PELUANG ENTRY: Trend mula mengukuh (${scoreMTF}/${totalCount} Bullish). Sesuai untuk entry fasa awal. Cadangan: HOLD / BUY.`;
            color = "text-emerald-300";
        } else if (scoreMTF > 0) {
            advice = isOwned
                ? `AMARAN AWAL: Trend mula lemah (${scoreMTF}/${totalCount} Bullish). Momentum intraday merosot. Cadangan: AMBIL UNTUNG (TP) atau ketatkan Stop-Loss.`
                : `TUNGGU: Trend teknikal masih lemah (${scoreMTF}/${totalCount} Bullish). Jangan kejar harga (Don't Chase). Pantau isyarat reversal.`;
            color = "text-yellow-400";
            type = "neutral";
        } else {
            advice = isOwned
                ? `EXIT SEGERA: Trend Bearish (0/${totalCount} Bullish). Tekanan jualan tinggi. Cadangan: JUAL (CUT) untuk lindungi modal anda.`
                : `ELAKKAN (AVOID): Trend Bearish sepenuhnya (0/${totalCount} Bullish). Risiko jatuh lebih dalam adalah tinggi buat masa ini.`;
            color = "text-red-400";
            type = "sell";
        }

        // Special Reversal Message
        if (scoreMTF < totalCount && scoreMTF > 0 && (trend15m === 'Bullish' || trend1h === 'Bullish')) {
            advice = isOwned
                ? `RECOVERY DETECTED: Harga mula memulih di timeframe ${trend15m === 'Bullish' ? '15M' : '1H'}. KEKAL PEGANG & pantau jika trend kembali Bullish sepenuhnya.`
                : `SPECULATIVE BUY: Isyarat pemulihan awal dikesan pada ${trend15m === 'Bullish' ? '15M' : '1H'}. Cadangan: MONITOR & Pantau Confirmation.`;
            color = "text-[#00ff9d]";
            type = "hold";
        }

        // Macro Perspective (Re-run analyzeStock with latest info)
        let liveStockResult = null;
        if (candlesDaily.length > 0) {
            const history = [...candlesDaily];
            const latestInfo = livePrice ? {
                open: Number(livePrice.open || livePrice.close),
                high: Number(livePrice.high || livePrice.close),
                low: Number(livePrice.low || livePrice.close),
                close: Number(livePrice.close),
                volume: Number(livePrice.volume || 0),
                date: livePrice.priceDate
            } : null;

            if (latestInfo) {
                const lastDay = history[history.length - 1];
                const lastDayDatePart = lastDay.date.split('T')[0];
                const latestDatePart = latestInfo.date.split('T')[0];

                if (lastDayDatePart === latestDatePart) {
                    history[history.length - 1] = { ...lastDay, ...latestInfo };
                } else {
                    history.push(latestInfo);
                }
            }

            liveStockResult = analyzeStock({
                code: ticker,
                company: '',
                prices: history
            });

            if (liveStockResult) {
                delete liveStockResult.company;
                delete liveStockResult.fullName;
            }
        }

        return {
            ticker,
            currentPrice,
            alignment,
            scoreMTF,
            totalCount,
            advice,
            adviceType: type,
            adviceColor: color,
            lastUpdated: new Date().toISOString(),
            ha4h,
            liveStock: liveStockResult
        };

    } catch (err) {
        console.error('analyzeIntraday Error:', err);
        throw err;
    }
};
