/**
 * BTST Engine
 * Integrated with Coach's Pine Script Strategy (accuracy focus).
 */

/**
 * Handles Bursa Malaysia price tick steps
 */
function mintick(price) {
    let tick = 0.005;
    if (price >= 1.00 && price < 10.00) tick = 0.01;
    else if (price >= 10.00 && price < 100.00) tick = 0.02;
    else if (price < 1.00) tick = 0.005;
    else tick = 0.001; // default fallback

    return Math.round(price / tick) * tick;
}

/**
 * Simple RSI Calculation
 */
function calculateRSI(closes, period = 14) {
    if (closes.length <= period) return 50;
    
    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
}

function computeSMA(values, period) {
    if (!values || values.length < period) return 0;
    const slice = values.slice(-period);
    const sum = slice.reduce((a, b) => a + (b || 0), 0);
    return sum / period;
}

/**
 * Calculates BTST metrics and scores for a single stock.
 * 
 * @param {Object} stockData { code, company, prices: [{open, high, low, close, volume, date}] }
 */
export function calculateBtst(stockData) {
    const { prices } = stockData;
    const len = prices.length;

    if (len < 90) return null; // Need 90 days for full volume SMA checks

    const today = prices[len - 1];
    const yesterday = prices[len - 2];
    const volumes = prices.map(p => Number(p.volume));
    const closes = prices.map(p => Number(p.close));

    // 1. Coach's Volume Filters (SMA 10, 30, 60, 90 > 500k)
    const vma10 = computeSMA(volumes, 10);
    const vma30 = computeSMA(volumes, 30);
    const vma60 = computeSMA(volumes, 60);
    const vma90 = computeSMA(volumes, 90);
    const hasStrongVolumeBase = vma10 > 500000 && vma30 > 500000 && vma60 > 500000 && vma90 > 500000;

    // 2. Momentum & RSI
    const dailyChangePercent = yesterday.close > 0 ? ((today.close - yesterday.close) / yesterday.close) * 100 : 0;
    const rsi14 = calculateRSI(closes, 14);
    
    // 3. Coach's Levels Formulas (Based on High - tick)
    const tick = today.close < 1 ? 0.005 : (today.close >= 1 && today.close < 10 ? 0.01 : 0.02);
    const maxEP = mintick(today.high - tick);
    const minEP = mintick(0.975 * maxEP); // RiskPerc defined by 2.5% in Pine Script
    const targetProfit = mintick(1.025 * maxEP); // RewardPerc defined by 2.5% in Pine Script
    const cutLoss = mintick(minEP - tick);

    // 4. Scoring Logic (Max 9)
    let score = 0;
    const reasons = [];

    // Criteria 1: Volume Base (The most important in this strategy)
    if (hasStrongVolumeBase) {
        score += 3;
        reasons.push("Strong Multi-SMA Volume (>500k)");
    }

    // Criteria 2: Daily Momentum (Coach requires >= 4%)
    if (dailyChangePercent >= 4) {
        score += 3;
        reasons.push("High Momentum (>4%)");
    } else if (dailyChangePercent >= 2) {
        score += 1;
        reasons.push("Moderate Momentum");
    }

    // Criteria 3: RSI Control (Allow up to 80 for strong BTST candidates)
    if (rsi14 < 70) {
        score += 2;
        reasons.push("Healthy RSI (<70)");
    } else if (rsi14 <= 80) {
        score += 2;
        reasons.push("Extreme Momentum (RSI 70-80)");
    } else {
        reasons.push("Overextended RSI (>80)");
    }

    // Criteria 4: Close Position (Close within EP range)
    if (today.close <= maxEP && today.close > cutLoss) {
        score += 1;
        reasons.push("Within Valid Entry Zone");
    }

    return {
        ticker: stockData.code,
        company: stockData.company,
        close: today.close,
        changePercent: dailyChangePercent,
        rsi: parseFloat(rsi14.toFixed(2)),
        score,
        reasons,
        // Nomenclature from Pine Script
        maxEntry: maxEP,
        minEntry: minEP,
        targetPrice: targetProfit,
        stopLoss: cutLoss,
        planType: 'Momentum BTST',
        lastUpdate: today.date
    };
}
