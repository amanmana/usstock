/**
 * Maps the API response from analyzeStockOnDemand or getIntradayAnalysisV2 
 * to a ticker-agnostic tradePlan object.
 */
export function mapAnalysisToTradePlan(apiResponse) {
    if (!apiResponse || apiResponse.error) {
        return null;
    }

    const liveStock = apiResponse.liveStock || apiResponse;
    const stats = liveStock.stats || {};
    const levels = liveStock.levels || {};
    const intraday = apiResponse.alignment || {};
    const ha4h = apiResponse.ha4h || {};

    const score = parseFloat(liveStock.score) || 0;
    const momentumScore = parseFloat(liveStock.momentumScore) || 0;

    // Logic from StockModal for conviction
    let convictionPct = Math.round(score * 10);
    const rrNum = levels.rr1 || 0;

    let bonus = 0;
    if (liveStock.isMinervini) bonus += 8;
    if (apiResponse.scoreMTF === 3) bonus += 15;
    if (apiResponse.verdict === 'GO') bonus += 10;
    if (apiResponse.verdict === 'DBL GO') bonus += 20;
    convictionPct = Math.min(99, convictionPct + bonus);

    // Verdict Label Logic
    let verdictLabel = "WAIT";
    if (score >= 8.5 && (apiResponse.verdict === 'GO' || apiResponse.verdict === 'DBL GO')) {
        verdictLabel = "DOUBLE GO";
    } else if (score >= 7.0 || apiResponse.verdict === 'GO') {
        verdictLabel = "GO / BUY";
    } else if (score >= 5.5) {
        verdictLabel = "WAIT / MONITOR";
    } else {
        verdictLabel = "AVOID";
    }

    // Checklist logic
    const checklist = [
        { label: `Macro Score: ${score.toFixed(1)}`, passed: score >= 7.0 },
        { label: `Risk/Reward: ${rrNum?.toFixed(2)}`, passed: rrNum >= 2.0 },
        { label: "Daily HA Confirmation", passed: !!liveStock.heikinAshiGo },
        { label: "4H Intraday Confirmation", passed: ha4h.color === 'Green' },
        { label: "RSI Not Overbought", passed: stats.rsi14 < 70 },
        { label: "Stoch Timing (K > D, Not OB)", passed: !!(stats.stoch?.k > stats.stoch?.d && stats.stoch?.k <= 80) }
    ];

    const holdingChecklist = [
        {
            label: "Target TP1 Hit?",
            value: (apiResponse.currentPrice || liveStock.close) >= (levels.target1 || 0) ? "REACHED" : "PENDING",
            passed: (apiResponse.currentPrice || liveStock.close) >= (levels.target1 || 0),
            note: (apiResponse.currentPrice || liveStock.close) >= (levels.target1 || 0) ? "Mula rancang Take Profit." : "Belum capai target pertama."
        },
        {
            label: "Normal Momentum?",
            value: (stats.rsi14 >= 40 && stats.rsi14 <= 75) ? "HEALTHY" : (stats.rsi14 > 75 ? "O-BOUGHT" : "WEAK"),
            passed: stats.rsi14 >= 40 && stats.rsi14 <= 75,
            note: stats.rsi14 > 75 ? "Hati-hati, momentum melampau." : (stats.rsi14 < 40 ? "Momentum mula surut." : "Harga stabil untuk kenaikan.")
        },
        {
            label: "Volume Normal?",
            value: stats.isVolumeDistribution ? "SELL OFF" : "LOW VOL",
            passed: !stats.isVolumeDistribution,
            note: stats.isVolumeDistribution ? "Ada unsur jualan besar (Distribusi)." : "Tiada tekanan jualan agresif."
        },
        {
            label: "Breakeven Secured?",
            value: (apiResponse.currentPrice || liveStock.close) >= (levels.rr2_price || apiResponse.currentPrice || liveStock.close) ? "SAFE" : "AT RISK",
            passed: (apiResponse.currentPrice || liveStock.close) >= (levels.rr2_price || apiResponse.currentPrice || liveStock.close),
            note: "Checking against entry/queue price."
        }
    ];

    return {
        ticker: apiResponse.ticker || liveStock.ticker,
        company_name: liveStock.fullName || liveStock.company || "Unknown",
        shariah_status: liveStock.isShariah ? 'SHARIAH' : 'NON_SHARIAH',
        snapshotScore10: score,
        momentumScore10: momentumScore,
        verdictLabel,
        convictionPct,
        price: apiResponse.currentPrice || liveStock.close || 0,
        sentiment4h: ha4h.color || 'Neutral',
        lastCheckedAt: apiResponse.lastUpdated || new Date().toISOString(),
        multiTimeframe: {
            tf15m: intraday.m15 === 'Bullish',
            tf4h: ha4h.color === 'Green',
            tf1d: intraday.d1 === 'Bullish',
            confirmedCount: apiResponse.scoreMTF || 0,
            totalCount: apiResponse.totalCount || 3
        },
        indicators: {
            rsi14: stats.rsi14,
            drawdownPct: stats.dropdownPercent,
            ma20: stats.ma20,
            ma50: stats.ma50,
            ma200: stats.ma200, // Added based on StockModal usage
            atr14: stats.atr14,
            stochK: stats.stoch?.k,
            stochD: stats.stoch?.d
        },
        trade: {
            strategyLabel: liveStock.recommendedTab === 'momentum' ? 'Momentum' : 'Rebound',
            entryTriggerText: liveStock.planText?.entryTrigger || "Menunggu isyarat harga",
            entryPrice: levels.rr2_price || apiResponse.currentPrice || liveStock.close,
            stopLoss: levels.stopPrice,
            tp1: levels.target1,
            tp2: levels.target2,
            rrRatio: levels.rr1,
            queuePrice: levels.rr2_price
        },
        checklist,
        holdingChecklist,
        raw: apiResponse // Keep raw for compatibility if needed
    };
}
