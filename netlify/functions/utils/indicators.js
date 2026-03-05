// Input: array of { open: number, high: number, low: number, close: number, volume: number } sorted by date ascending (oldest -> newest)

export function computeHeikinAshi(prices) {
    if (!prices || prices.length === 0) return [];

    const haData = [];

    let prevOpen = prices[0].open || prices[0].close;
    let prevClose = prices[0].close;

    for (let i = 0; i < prices.length; i++) {
        const p = prices[i];

        const currentOpen = p.open || p.close;
        const currentHigh = p.high || p.close;
        const currentLow = p.low || p.close;
        const currentClose = p.close;

        const haClose = (currentOpen + currentHigh + currentLow + currentClose) / 4;
        const haOpen = (prevOpen + prevClose) / 2;
        const haHigh = Math.max(currentHigh, haOpen, haClose);
        const haLow = Math.min(currentLow, haOpen, haClose);

        haData.push({
            open: haOpen,
            high: haHigh,
            low: haLow,
            close: haClose,
            date: p.date || p.price_date
        });

        prevOpen = haOpen;
        prevClose = haClose;
    }

    return haData;
}

export function computeSMA(values, period) {
    if (!values || values.length < period) return null;
    const slice = values.slice(-period);
    const sum = slice.reduce((a, b) => a + (b || 0), 0);
    return sum / period;
}

export function computeEMA(values, period) {
    if (!values || values.length === 0) return null;
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
        ema = values[i] * k + ema * (1 - k);
    }
    return ema;
}

export function computeRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

export function computeStdDev(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sqDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSqDiff);
}

export function computeStochastic(prices, kPeriod = 14, slowing = 1, dPeriod = 3) {
    if (!prices || prices.length < kPeriod + slowing + dPeriod) return null;

    const fastKs = [];
    for (let i = kPeriod - 1; i < prices.length; i++) {
        const window = prices.slice(i - kPeriod + 1, i + 1);
        const lows = window.map(p => p.low || p.close);
        const highs = window.map(p => p.high || p.close);
        const currentClose = prices[i].close;
        const lowestLow = Math.min(...lows);
        const highestHigh = Math.max(...highs);

        const fastK = highestHigh === lowestLow ? 50 : ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
        fastKs.push(fastK);
    }

    const slowKs = [];
    if (slowing === 1) {
        slowKs.push(...fastKs);
    } else {
        for (let i = slowing - 1; i < fastKs.length; i++) {
            const slice = fastKs.slice(i - slowing + 1, i + 1);
            const avgK = slice.reduce((a, b) => a + b, 0) / slowing;
            slowKs.push(avgK);
        }
    }

    const ds = [];
    for (let i = dPeriod - 1; i < slowKs.length; i++) {
        const slice = slowKs.slice(i - dPeriod + 1, i + 1);
        const avgD = slice.reduce((a, b) => a + b, 0) / dPeriod;
        ds.push(avgD);
    }

    const lastK = slowKs[slowKs.length - 1];
    const lastD = ds[ds.length - 1];
    const prevK = slowKs[slowKs.length - 2];
    const prevD = ds[ds.length - 2];

    return {
        k: lastK,
        d: lastD,
        prevK,
        prevD,
        stochState: lastK > lastD ? 'Bullish' : 'Bearish'
    };
}

export function computeATR(prices, period = 14) {
    if (!prices || prices.length < period + 1) return null;

    const trs = [];
    for (let i = 1; i < prices.length; i++) {
        const h = prices[i].high || prices[i].close;
        const l = prices[i].low || prices[i].close;
        const pc = prices[i - 1].close;
        const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        trs.push(tr);
    }

    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < trs.length; i++) {
        atr = (atr * (period - 1) + trs[i]) / period;
    }

    return atr;
}

export function analyzeStock(stockData) {
    const { code, company, prices } = stockData;
    const closes = (prices || []).map(p => Number(p.close));
    const volumes = (prices || []).map(p => Number(p.volume));

    const len = closes.length;
    if (len === 0) return null;

    const closeToday = closes[len - 1];
    const closeYesterday = len > 1 ? closes[len - 2] : null;
    const close2DaysAgo = len > 2 ? closes[len - 3] : null;
    const close5DaysAgo = len > 5 ? closes[len - 6] : null;

    const volumeToday = volumes[len - 1];

    const ma10 = computeSMA(closes, 10);
    const ma20 = computeSMA(closes, 20);
    const ma50 = computeSMA(closes, 50);
    const ma150 = computeSMA(closes, 150);
    const ma200 = computeSMA(closes, 200);
    const rsi14 = computeRSI(closes, 14);
    const stoch = computeStochastic(prices, 14, 1, 3);
    const atr14 = computeATR(prices, 14);

    const haPrices = computeHeikinAshi(prices);
    const haLen = haPrices.length;
    let heikinAshiGo = false;
    let haState = 'Neutral';
    let haDetails = { status: 'WAIT', reason: 'Tiada Data' };

    if (haLen >= 2) {
        const haToday = haPrices[haLen - 1];
        const haYesterday = haPrices[haLen - 2];

        const isGreen = haToday.close > haToday.open;
        const prevWasRed = haYesterday.close <= haYesterday.open;
        const noLowerWick = Math.abs(haToday.low - haToday.open) < (haToday.open * 0.001);

        haState = isGreen ? 'Bullish' : 'Bearish';

        if (isGreen) {
            heikinAshiGo = true;
            if (prevWasRed) {
                haDetails = { status: 'GO', reason: 'Reversal (Tukar Hijau)' };
            } else if (noLowerWick) {
                haDetails = { status: 'GO', reason: 'Strong Bullish (Tiada Ekor Bawah)' };
            } else {
                haDetails = { status: 'GO', reason: 'Kekal Hijau (Normal)' };
            }
        } else {
            haDetails = { status: 'WAIT', reason: 'Lilin HA Merah' };
        }
    }

    const avgVol20 = computeSMA(volumes, 20);
    const avgVol5 = computeSMA(volumes, 5);

    let pivotsLow = [];
    let pivotsHigh = [];
    const k = 3;

    for (let i = k; i < len - k; i++) {
        const window = closes.slice(i - k, i + k + 1);
        const center = closes[i];
        if (center === Math.min(...window)) pivotsLow.push({ price: center, index: i });
        if (center === Math.max(...window)) pivotsHigh.push({ price: center, index: i });
    }

    let support = null;
    let fallbackSupportUsed = false;
    const sortedLow = [...pivotsLow].sort((a, b) => b.index - a.index);
    const foundLow = sortedLow.find(p => p.price < closeToday * 0.998 && p.price > closeToday * 0.70);

    if (foundLow) {
        support = foundLow.price;
    } else if (len >= 20) {
        const recentLow = Math.min(...closes.slice(-Math.min(len, 60)));
        support = Math.max(recentLow, closeToday * 0.85);
        fallbackSupportUsed = true;
    }

    let resistance = null;
    const sortedHigh = [...pivotsHigh].sort((a, b) => b.index - a.index);
    const foundHigh = sortedHigh.find(p => p.price > closeToday * 1.002);

    if (foundHigh) {
        resistance = foundHigh.price;
    } else if (len >= 20) {
        resistance = Math.max(...closes.slice(-Math.min(len, 60)));
    }

    const countTouches = (level) => {
        if (!level) return 0;
        const last60 = closes.slice(-60);
        return last60.filter(c => Math.abs(c - level) / level <= 0.01).length;
    };

    const sTouch = countTouches(support);
    const rTouch = countTouches(resistance);
    const sStrength = sTouch >= 4 ? "Strong" : sTouch >= 2 ? "Medium" : "Weak";
    const rStrength = rTouch >= 4 ? "Strong" : rTouch >= 2 ? "Medium" : "Weak";

    const returns = [];
    for (let i = Math.max(1, len - 20); i < len; i++) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const vol20 = computeStdDev(returns);
    const volUsed = Math.min(vol20, 0.06);
    const stopVol = closeToday * (1 - 1.5 * volUsed);

    let stopPrice = closeToday * 0.95;
    if (support && support < closeToday) {
        const supportStop = support * 0.99;
        if (supportStop < closeToday * 0.99 && supportStop > closeToday * 0.85) {
            stopPrice = Math.min(supportStop, stopVol);
        } else {
            stopPrice = stopVol;
        }
    } else {
        stopPrice = stopVol;
    }

    const minStop = closeToday * 0.85;
    const maxStop = closeToday * 0.98;
    stopPrice = Math.max(minStop, Math.min(maxStop, stopPrice));

    const target1 = resistance && resistance > closeToday * 1.01 ? resistance : closeToday * 1.05;
    const target2Pivot = sortedHigh.find(p => p.price > target1 * 1.02);
    const target2 = target2Pivot ? target2Pivot.price : Math.max(target1 * 1.07, closeToday * 1.15);

    const rr1 = (target1 - closeToday) / (closeToday - stopPrice);
    const rr2_price = parseFloat(((target1 + 2 * stopPrice) / 3).toFixed(3));

    const reclaimedMA20 = ma20 && closeToday > ma20 && closeYesterday <= ma20;
    let entryTrigger = "Menunggu isyarat harga";
    if (reclaimedMA20) entryTrigger = "Melepasi MA20 (Sedia Beli)";
    else if (closeToday > ma20) entryTrigger = "Atas MA20 (Pegang / Beli masa turun)";
    else entryTrigger = "Tunggu harga pecah MA20 ke atas @ " + (ma20?.toFixed(3) || "N/A");

    const high20 = len >= 20 ? Math.max(...closes.slice(-20)) : Math.max(...closes);
    const dropdown = ((high20 - closeToday) / high20) * 100;
    const ret5d = close5DaysAgo ? ((closeToday - close5DaysAgo) / close5DaysAgo) * 100 : 0;

    let scoreA = 0;
    let scoreB = 0;
    let scoreC = 0;

    let maxScoreCap = 10;
    let historyLabel = '';

    if (len < 60) {
        maxScoreCap = 6.5;
        historyLabel = 'Limited History (Small)';
        if (ma20 && closeToday > ma20) scoreA += 1;
    } else if (len < 200) {
        maxScoreCap = 8.0;
        historyLabel = 'Limited History (Medium)';
    }

    if (ma50 && closeToday > ma50) scoreA += 2;
    if (ma50 && ma200 && ma50 > ma200) scoreA += 1;
    if (ma200 && closeToday > ma200) scoreA += 1;

    if (dropdown >= 6 && dropdown <= 18) scoreB += 1;
    if (ma50 && (closeToday >= ma50 || (ma50 - closeToday) / ma50 <= 0.02)) scoreB += 1;
    if (rsi14 >= 35 && rsi14 <= 50) scoreB += 1;

    if (reclaimedMA20) scoreC += 1;
    if (avgVol5 && volumeToday > 1.2 * avgVol5) scoreC += 1;
    const twoGreens = closeToday > closeYesterday && closeYesterday > close2DaysAgo;
    if (twoGreens) scoreC += 1;

    let totalScore = scoreA + scoreB + scoreC;
    if (totalScore > maxScoreCap) totalScore = maxScoreCap;

    let momentumScore = 0;
    if (ma20 && ma50 && ma20 > ma50) momentumScore += 1.5;
    if (ma50 && ma200 && ma50 > ma200) momentumScore += 1;
    if (ma20 && closeToday > ma20) momentumScore += 1;
    if (ma50 && closeToday > ma50) momentumScore += 0.5;

    if (avgVol20 && volumeToday > 1.25 * avgVol20) momentumScore += 2;
    else if (avgVol20 && volumeToday > avgVol20) momentumScore += 1;

    if (rsi14 >= 50 && rsi14 <= 75) momentumScore += 1.5;
    const high60 = len >= 60 ? Math.max(...closes.slice(-60)) : (len >= 20 ? Math.max(...closes.slice(-20)) : Math.max(...closes));
    if (closeToday >= high60 * 0.98) momentumScore += 1.5;
    else if (closeToday >= high60 * 0.95) momentumScore += 0.5;

    if (momentumScore > maxScoreCap) momentumScore = maxScoreCap;

    const high200 = len >= 200 ? Math.max(...closes.slice(-200)) : Math.max(...closes);
    const low200 = len >= 200 ? Math.min(...closes.slice(-200)) : Math.min(...closes);
    const ma200_prev20 = len >= 220 ? computeSMA(closes.slice(0, -20), 200) : ma200;

    const isMinervini =
        ma150 && ma200 && ma50 &&
        closeToday > ma50 &&
        ma50 > ma150 &&
        ma150 > ma200 &&
        ma200 > (ma200_prev20 || 0) &&
        closeToday >= low200 * 1.30 &&
        closeToday >= high200 * 0.75;

    const isStochOversold = stoch && stoch.k <= 40;
    const stochCrossUp = stoch && stoch.prevK <= stoch.prevD && stoch.k > stoch.d;
    const stochBuy = isStochOversold && stochCrossUp;

    const distMA10 = ma10 ? Math.abs(closeToday - ma10) / ma10 : 1;
    const distMA20 = ma20 ? Math.abs(closeToday - ma20) / ma20 : 1;
    const isNearSupport = (distMA10 >= 0 && distMA10 <= 0.05) || (distMA20 >= 0 && distMA20 <= 0.05);

    const isSuperPullback = isMinervini && stochBuy && isNearSupport;

    const isParabolic = ma10 && (closeToday > ma10 * 1.10);
    const isVolumeDistribution = closeYesterday && closeToday < closeYesterday && avgVol20 && volumeToday > 1.5 * avgVol20;
    const stochOverbought = stoch && stoch.k >= 70;
    const stochCrossDown = stoch && stoch.prevK >= stoch.prevD && stoch.k < stoch.d;
    const stochSell = stochOverbought && stochCrossDown;
    const stochState = stoch?.stochState || 'Bearish';
    const volumeSurge = avgVol20 && volumeToday > 1.5 * avgVol20;

    const nearMA50 = ma50 && Math.abs(closeToday - ma50) / ma50 <= 0.015 && closeToday >= ma50;
    const nearMA200 = ma200 && Math.abs(closeToday - ma200) / ma200 <= 0.015 && closeToday >= ma200;
    const isMASupport = nearMA50 || nearMA200;

    const signals = [];
    if (scoreA >= 3) signals.push('UPTREND');
    if (scoreB >= 2) signals.push('PULLBACK');
    if (scoreC >= 2) signals.push('REBOUND');
    if (momentumScore >= 7) signals.push('MOMENTUM');
    if (isMinervini) signals.push('MINERVINI-SETUP');
    if (stochBuy) signals.push('STOCH-BUY');
    if (isSuperPullback) signals.push('SUPER-PULLBACK');
    if (isMASupport) signals.push('MA-SUPPORT');
    if (heikinAshiGo) signals.push('HEIKIN-ASHI-GO');
    if (avgVol20 && volumeToday > 2.0 * avgVol20) signals.push('VOLUME-SURGE');

    const recommendedTab = momentumScore > totalScore ? 'momentum' : 'rebound';

    const recent20 = closes.slice(-20);
    let zeroMoveDays = 0;
    for (let i = 1; i < recent20.length; i++) {
        if (recent20[i] === recent20[i - 1]) zeroMoveDays++;
    }
    const staleness = (zeroMoveDays / 19) * 100;

    let rejectReason = null;
    if (ret5d > 35) rejectReason = 'Pump (5D > 35%)';
    if (avgVol20 < 150000) rejectReason = 'Low Liquidity (Vol < 150k)';
    if (staleness > 30) rejectReason = 'Sikat (Flat Price Action)';

    const watchNext = [];
    if (ma20 && !reclaimedMA20 && closeToday < ma20) watchNext.push('Perhatikan harga pecah MA20');
    if (volumeToday <= (avgVol5 || 0)) watchNext.push('Tunggu kemasukan Volume');
    if (ma50 && Math.abs(closeToday - ma50) / ma50 < 0.03) watchNext.push('Pantau paras sokongan MA50');

    return {
        ticker: code,
        company,
        fullName: stockData.fullName || company,
        close: closeToday,
        volume: volumeToday,
        date: stockData.date,
        score: parseFloat(totalScore.toFixed(1)),
        momentumScore: parseFloat(momentumScore.toFixed(1)),
        isMinervini,
        isMASupport,
        recommendedTab,
        signals,
        heikinAshiGo,
        haDetails,
        haState,
        stoch,
        stochState,
        rejectReason,
        stats: {
            ma10, ma20, ma50, ma150, ma200, rsi14,
            dropdownPercent: parseFloat(dropdown.toFixed(1)),
            ret5d: parseFloat(ret5d.toFixed(1)),
            avgVol20,
            volumeSurge,
            atr14,
            isParabolic,
            isVolumeDistribution,
            stochSell,
            stochCrossUp,
            stochCrossDown
        },
        levels: {
            support,
            resistance,
            supportStrength: sStrength,
            resistanceStrength: rStrength,
            stopPrice: parseFloat(stopPrice.toFixed(3)),
            target1: parseFloat(target1.toFixed(3)),
            target2: parseFloat(target2.toFixed(3)),
            rr1: parseFloat(rr1.toFixed(2)),
            rr2_price
        },
        planText: {
            entryTrigger,
            invalidationRule: `Tutup bawah ${stopPrice.toFixed(3)} (Sokongan bocor/Vol)`,
            notes: [
                fallbackSupportUsed ? "S/R guna julat harga (tiada pivot baru)" : "S/R guna pivot harga sebenar",
                rTouch > 3 ? "Rintangan atas yang kuat" : "Ruang naik yang luas",
                vol20 > 0.03 ? "Saham naik turun laju - cut loss lebih luas" : "Pergerakan harga stabil"
            ]
        },
        watchNext,
        historyLabel
    };
}
