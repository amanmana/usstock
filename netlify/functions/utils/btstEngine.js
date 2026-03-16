/**
 * BTST Engine
 * Specialized logic for Buy Today, Sell Tomorrow (BTST) signals.
 */

/**
 * Calculates BTST metrics and scores for a single stock.
 * 
 * @param {Object} stockData { code, company, prices: [{open, high, low, close, volume, date}] }
 */
export function calculateBtst(stockData) {
    const { prices } = stockData;
    const len = prices.length;

    if (len < 5) return null; // Minimum 5 days for basic breakout check

    const today = prices[len - 1];
    const prev5Days = prices.slice(-6, -1);
    const volumes = prices.map(p => Number(p.volume));
    const closes = prices.map(p => Number(p.close));

    // 1. Close Near High (CNH)
    // Formula: (Close - Low) / (High - Low) or Close >= 97% of High
    const highLowRange = today.high - today.low;
    const cpr = highLowRange === 0 ? 0.5 : (today.close - today.low) / highLowRange;
    const isCloseNearHigh = today.close >= 0.97 * today.high;

    // 2. Relative Volume (RVOL)
    // Formula: Volume today / Average volume last 20 days
    const avgVol20 = computeSMA(volumes, 20) || computeSMA(volumes, len);
    const rvol = avgVol20 > 0 ? today.volume / avgVol20 : 0;

    // 3. Daily Momentum
    const prevClose = prices[len - 2].close;
    const dailyChangePercent = prevClose > 0 ? ((today.close - prevClose) / prevClose) * 100 : 0;

    // 4. Value Traded (Liquidity)
    const valueTraded = today.close * today.volume;

    // 5. Breakout Check (Max High of last 5 days)
    const highestHigh5D = Math.max(...prev5Days.map(p => p.high));
    const isBreakout5D = today.close > highestHigh5D;

    // 6. Trend Filter (Close > SMA20)
    const sma20 = computeSMA(closes, 20);
    const isAboveSMA20 = sma20 ? today.close > sma20 : true;

    // SCORING (Maximum 9)
    let score = 0;
    const details = [];

    // Scoring Criteria
    if (isCloseNearHigh) {
        score += 2;
        details.push('Close Near High');
    } else if (cpr > 0.8) {
        score += 1;
        details.push('Strong Close Position');
    }

    if (rvol >= 1.8) {
        score += 2;
        details.push('Volume Spike (High RVOL)');
    } else if (rvol >= 1.2) {
        score += 1;
        details.push('Good Volume');
    }

    if (isBreakout5D) {
        score += 2;
        details.push('5-Day Breakout');
    }

    if (dailyChangePercent >= 3) {
        score += 1;
        details.push('Daily Bullish Momentum');
    }

    if (valueTraded >= 2000000) {
        score += 1;
        details.push('Healthy Liquidity');
    }

    if (isAboveSMA20) {
        score += 1;
        details.push('Short-term Uptrend');
    }

    return {
        ticker: stockData.code,
        company: stockData.company,
        close: today.close,
        changePercent: dailyChangePercent,
        rvol: parseFloat(rvol.toFixed(2)),
        valueTraded: Math.round(valueTraded),
        isBreakout5D,
        isCloseNearHigh,
        score,
        reasons: details,
        lastUpdate: today.date
    };
}

function computeSMA(values, period) {
    if (!values || values.length < period) return null;
    const slice = values.slice(-period);
    const sum = slice.reduce((a, b) => a + (b || 0), 0);
    return sum / period;
}
