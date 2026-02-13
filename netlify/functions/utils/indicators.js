// Input: array of { close: number, volume: number } sorted by date ascending (oldest -> newest)

export function computeSMA(values, period) {
    if (!values || values.length < period) return null;
    const slice = values.slice(-period);
    const sum = slice.reduce((a, b) => a + (b || 0), 0);
    return sum / period;
}

export function computeRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    // Initial calculation
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Smoothed calculation for subsequent values
    // We only need the *latest* RSI, so just calculate up to end.
    // Actually, standard RSI uses Wilder's Smoothing.
    // RSI = 100 - 100 / (1 + RS)
    // RS = AvgGain / AvgLoss

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

export function analyzeStock(stockData) {
    const { code, company, prices } = stockData;
    const closes = prices.map(p => p.close);
    const volumes = prices.map(p => p.volume);

    const len = closes.length;
    if (len === 0) return null; // No data

    const closeToday = closes[len - 1];
    const closeYesterday = len > 1 ? closes[len - 2] : null;
    const close2DaysAgo = len > 2 ? closes[len - 3] : null;
    const close5DaysAgo = len > 5 ? closes[len - 6] : null;

    const volumeToday = volumes[len - 1];

    // Indicators
    const ma20 = computeSMA(closes, 20);
    const ma50 = computeSMA(closes, 50);
    const ma200 = computeSMA(closes, 200);
    const rsi14 = computeRSI(closes, 14);

    // 20D Avg Vol
    const avgVol20 = computeSMA(volumes, 20);
    const avgVol5 = computeSMA(volumes, 5); // for rebound Volume expansion

    // Support / Resistance Logic (Pivot Method k=3)
    let pivotsLow = [];
    let pivotsHigh = [];
    const k = 3;

    // Scan history for pivots (excluding very recent days that can't be confirmed)
    for (let i = k; i < len - k; i++) {
        const window = closes.slice(i - k, i + k + 1);
        const center = closes[i];
        if (center === Math.min(...window)) pivotsLow.push({ price: center, index: i });
        if (center === Math.max(...window)) pivotsHigh.push({ price: center, index: i });
    }

    // Nearest Support (below current price)
    // SANITY: Pivot must be within 30% of current price to be considered structural support
    let support = null;
    let fallbackSupportUsed = false;
    const sortedLow = [...pivotsLow].sort((a, b) => b.index - a.index); // latest first
    const foundLow = sortedLow.find(p => p.price < closeToday * 0.998 && p.price > closeToday * 0.70);

    if (foundLow) {
        support = foundLow.price;
    } else if (len >= 20) {
        // Fallback to recent low within last 60 days, but with a floor
        const recentLow = Math.min(...closes.slice(-Math.min(len, 60)));
        support = Math.max(recentLow, closeToday * 0.85);
        fallbackSupportUsed = true;
    }

    // Nearest Resistance (above current price)
    let resistance = null;
    const sortedHigh = [...pivotsHigh].sort((a, b) => b.index - a.index);
    const foundHigh = sortedHigh.find(p => p.price > closeToday * 1.002);

    if (foundHigh) {
        resistance = foundHigh.price;
    } else if (len >= 20) {
        resistance = Math.max(...closes.slice(-Math.min(len, 60)));
    }

    // Touch Count / Strength (last 60 days)
    const countTouches = (level) => {
        if (!level) return 0;
        const last60 = closes.slice(-60);
        return last60.filter(c => Math.abs(c - level) / level <= 0.01).length;
    };

    const sTouch = countTouches(support);
    const rTouch = countTouches(resistance);
    const sStrength = sTouch >= 4 ? "Strong" : sTouch >= 2 ? "Medium" : "Weak";
    const rStrength = rTouch >= 4 ? "Strong" : rTouch >= 2 ? "Medium" : "Weak";

    // Stop Loss / Invalidation
    const returns = [];
    for (let i = Math.max(1, len - 20); i < len; i++) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const vol20 = computeStdDev(returns);
    // Use volatility-based stop (2.0 x StdDev) with a ceiling (don't cap at more than 6% daily vol)
    const volUsed = Math.min(vol20, 0.06);
    const stopVol = closeToday * (1 - 1.5 * volUsed);

    // Choose the best stop: structural (support) or volatility
    let stopPrice = closeToday * 0.95; // Default 5%
    if (support && support < closeToday) {
        const supportStop = support * 0.99; // 1% below support
        // If support is too close (<1%), use vol stop
        // If support is too far (>15%), use vol stop
        if (supportStop < closeToday * 0.99 && supportStop > closeToday * 0.85) {
            stopPrice = Math.min(supportStop, stopVol); // Pick more conservative
        } else {
            stopPrice = stopVol;
        }
    } else {
        stopPrice = stopVol;
    }

    // Final Sanity Guard: Stop price must be between 2% and 15% distance, and always positive
    const minStop = closeToday * 0.85; // Max 15% risk
    const maxStop = closeToday * 0.98; // Min 2% risk
    stopPrice = Math.max(minStop, Math.min(maxStop, stopPrice));

    // Targets
    const target1 = resistance && resistance > closeToday * 1.01 ? resistance : closeToday * 1.05;
    const target2Pivot = sortedHigh.find(p => p.price > target1 * 1.02);
    const target2 = target2Pivot ? target2Pivot.price : Math.max(target1 * 1.07, closeToday * 1.15);

    const rr1 = (target1 - closeToday) / (closeToday - stopPrice);

    // Trade Plan Text
    const reclaimedMA20 = ma20 && closeToday > ma20 && closeYesterday <= ma20;
    let entryTrigger = "Menunggu isyarat harga";
    if (reclaimedMA20) entryTrigger = "Melepasi MA20 (Sedia Beli)";
    else if (closeToday > ma20) entryTrigger = "Atas MA20 (Pegang / Beli masa turun)";
    else entryTrigger = "Tunggu harga pecah MA20 ke atas @ " + (ma20?.toFixed(3) || "N/A");

    // 20D High
    const high20 = len >= 20 ? Math.max(...closes.slice(-20)) : Math.max(...closes);

    // Drawdown %
    const dropdown = ((high20 - closeToday) / high20) * 100;

    // 5D Return
    const ret5d = close5DaysAgo ? ((closeToday - close5DaysAgo) / close5DaysAgo) * 100 : 0;

    // --- Scoring Logic ---
    let scoreA = 0; // Uptrend (0-4)
    let scoreB = 0; // Pullback (0-3)
    let scoreC = 0; // Rebound (0-3)

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

    // --- Momentum Scoring Logic (New) ---
    let momentumScore = 0;
    // 1. Trend Alignment (0-4)
    if (ma20 && ma50 && ma20 > ma50) momentumScore += 1.5;
    if (ma50 && ma200 && ma50 > ma200) momentumScore += 1;
    if (ma20 && closeToday > ma20) momentumScore += 1;
    if (ma50 && closeToday > ma50) momentumScore += 0.5;

    // 2. Volume Confirmation (0-3)
    if (avgVol20 && volumeToday > 1.25 * avgVol20) momentumScore += 2;
    else if (avgVol20 && volumeToday > avgVol20) momentumScore += 1;

    // 3. Price Strength / RSI Zone (0-3)
    if (rsi14 >= 50 && rsi14 <= 75) momentumScore += 1.5;
    const high60 = len >= 60 ? Math.max(...closes.slice(-60)) : (len >= 20 ? Math.max(...closes.slice(-20)) : Math.max(...closes));
    if (closeToday >= high60 * 0.98) momentumScore += 1.5; // Near breakdown/breakout
    else if (closeToday >= high60 * 0.95) momentumScore += 0.5;

    if (momentumScore > maxScoreCap) momentumScore = maxScoreCap;

    // --- Advanced Signal Logic (New) ---
    const high200 = len >= 200 ? Math.max(...closes.slice(-200)) : Math.max(...closes);
    const low200 = len >= 200 ? Math.min(...closes.slice(-200)) : Math.min(...closes);

    // Minervini Trend Template (Approximate)
    const isMinervini =
        ma50 && ma200 && ma50 > ma200 &&
        closeToday > ma50 && closeToday > ma200 &&
        closeToday > low200 * 1.30 && // 30% above 200D low
        closeToday > high200 * 0.75; // Within 25% of 200D high

    // MA Support (Mean Reversion)
    const nearMA50 = ma50 && Math.abs(closeToday - ma50) / ma50 <= 0.015 && closeToday >= ma50;
    const nearMA200 = ma200 && Math.abs(closeToday - ma200) / ma200 <= 0.015 && closeToday >= ma200;
    const isMASupport = nearMA50 || nearMA200;

    const signals = [];
    if (scoreA >= 3) signals.push('UPTREND');
    if (scoreB >= 2) signals.push('PULLBACK');
    if (scoreC >= 2) signals.push('REBOUND');
    if (momentumScore >= 7) signals.push('MOMENTUM');
    if (isMinervini) signals.push('MINERVINI-SETUP');
    if (isMASupport) signals.push('MA-SUPPORT');

    // Recommendation for tab
    const recommendedTab = momentumScore > totalScore ? 'momentum' : 'rebound';

    // --- Liquidity / Staleness Filter (Sikat) ---
    // A stock is "sikat" (illiquid) if most candles have no movement (Close == Open/ClosePrev)
    const recent20 = closes.slice(-20);
    let zeroMoveDays = 0;
    for (let i = 1; i < recent20.length; i++) {
        if (recent20[i] === recent20[i - 1]) zeroMoveDays++;
    }
    const staleness = (zeroMoveDays / 19) * 100; // 19 intervals in 20 bars

    let rejectReason = null;
    if (ret5d > 35) rejectReason = 'Pump (5D > 35%)';
    if (avgVol20 < 150000) rejectReason = 'Low Liquidity (Vol < 150k)';
    if (staleness > 10) rejectReason = 'DEBUG: Sikat Detected';

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
        rejectReason,
        stats: {
            ma20, ma50, ma200, rsi14,
            dropdownPercent: parseFloat(dropdown.toFixed(1)),
            ret5d: parseFloat(ret5d.toFixed(1)),
            avgVol20
        },
        levels: {
            support,
            resistance,
            supportStrength: sStrength,
            resistanceStrength: rStrength,
            stopPrice: parseFloat(stopPrice.toFixed(3)),
            target1: parseFloat(target1.toFixed(3)),
            target2: parseFloat(target2.toFixed(3)),
            rr1: parseFloat(rr1.toFixed(2))
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
