
/**
 * Internal helper to build a standardized tradePlan object.
 * Standardizes mapping from analyzeIntraday output to the universal UI schema.
 * 
 * @param {Object} params
 * @param {string} params.ticker
 * @param {string} params.companyName
 * @param {string} params.shariahStatus
 * @param {Object} params.analysis - Output from analyzeIntraday
 * @param {string} params.market
 */
export function buildTradePlan({ ticker, companyName, shariahStatus, market, analysis }) {
    if (!analysis || analysis.error) {
        throw new Error(analysis?.error || 'Analysis data missing');
    }

    const liveStock = analysis.liveStock || {};
    const stats = liveStock.stats || {};
    const levels = liveStock.levels || {};

    // Extracted once to avoid redeclaration later
    const alignment = analysis.alignment || {};
    const ha4h = analysis.ha4h || {};

    const score = parseFloat(liveStock.score) || 0;
    const momentumScore = parseFloat(liveStock.momentumScore) || 0;

    // 1. RR standardization & Calculation
    const entry = levels.rr2_price || analysis.currentPrice || liveStock.close;
    const stopPrice = levels.stopPrice;
    const tp1 = levels.target1;
    const tp2 = levels.target2;

    let rrRatio = null;
    let rrNote = "Missing price levels";
    if (entry && stopPrice && entry > stopPrice) {
        const target = tp2 || tp1; // Priority TP2 for full reward potential
        if (target && target > entry) {
            rrRatio = (target - entry) / (entry - stopPrice);
            rrNote = rrRatio >= 2.0 ? "High RR Advantage" : `Weak RR (${rrRatio.toFixed(2)})`;
        } else {
            rrNote = "Invalid target price";
        }
    }

    // 2. Multi-timeframe alignment
    const totalCount = analysis.totalCount || 3;
    const confirmedCount = analysis.scoreMTF || 0;

    // 3. Conviction % Calculation
    let convictionPct = Math.round(score * 10);
    let bonus = 0;
    if (liveStock.isMinervini) bonus += 8;
    if (confirmedCount === totalCount && totalCount >= 2) bonus += 15;
    if (analysis.adviceType === 'buy' || confirmedCount >= 2) bonus += 10;

    // Final Decision Step (Moved up slightly to use for conviction)
    const isMTFAligned = confirmedCount === totalCount && totalCount >= 2;
    const isHighConviction = score >= 8.0;
    const isDoubleGoCandidate = rrRatio >= 2.0 && isMTFAligned && isHighConviction && (isPullback || isBreakout) && !isOverbought;

    if (isDoubleGoCandidate) bonus += 15;

    convictionPct = Math.min(100, convictionPct + bonus);

    // 4. Decision Engine Logic (Rule-based)
    const currentPrice = analysis.currentPrice || liveStock.close || 0;
    const isBullishTrend = stats.ma20 && stats.ma50 && stats.ma20 > stats.ma50;

    // Momentum mapping
    const isRSIHealthy = stats.rsi14 >= 40 && stats.rsi14 <= 60;
    const isOverbought = stats.rsi14 > 70;
    const isOversold = stats.rsi14 < 30;

    // Setup Detection (Refined & Less 'Stiff')
    const distToMA20 = stats.ma20 ? (currentPrice - stats.ma20) / stats.ma20 : 1;
    const isNearMA20 = Math.abs(distToMA20) <= 0.025;
    const isPullbackStr = isBullishTrend && distToMA20 > 0 && distToMA20 <= 0.05;
    const isPullback = isBullishTrend && isNearMA20;
    const isBreakout = levels.resistance && currentPrice > levels.resistance && stats.volumeSurge;
    const isHighRRWatch = rrRatio >= 2.0;

    let setupValue = "No Setup";
    let setupNote = "Tunggu setup terbentuk.";
    let setupPassed = isPullback || isBreakout || isPullbackStr;

    if (isBreakout) {
        setupValue = "Breakout";
        setupNote = "Pecah rintangan dengan volume.";
    } else if (isPullback) {
        setupValue = "Pullback";
        setupNote = "Harga di paras sokongan MA20.";
    } else if (isPullbackStr) {
        setupValue = "Pullback Str.";
        setupNote = "Struktur menarik, tunggu dekat MA20.";
    } else if (isHighRRWatch) {
        setupValue = "Base Building";
        setupPassed = true; // High RR makes it worth watching
        setupNote = "Membina tapak. Pantau untuk 'Reversal'.";
    }

    let verdictLabel = "WAIT";
    let advice = "Sila rujuk indikator teknikal untuk pengesahan.";

    if (!isBullishTrend) {
        if (rrRatio >= 2.0) {
            verdictLabel = "WAIT";
            advice = "MONITOR: Struktur 'Base Building' sedang terbentuk dengan RR menarik. Tunggu breakout MA20.";
        } else {
            verdictLabel = "AVOID";
            advice = "ELAKKAN (AVOID): Trend Bearish dan Risk/Reward tidak berbaloi buat masa ini.";
        }
    } else if (rrRatio && rrRatio < 1.3) {
        verdictLabel = "AVOID";
        advice = "RISIKO TINGGI: Nisbah risiko-ganjaran tidak menarik. Lebihkan tunai.";
    } else if (rrRatio >= 1.8 && (isPullback || isBreakout) && !isOverbought) {
        // Double Go Trigger
        const isMTFAligned = confirmedCount === totalCount && totalCount >= 2;
        const isHighConviction = score >= 8.0;

        if (isMTFAligned && isHighConviction && rrRatio >= 2.0) {
            verdictLabel = "DOUBLE GO";
            advice = "SAH: DOUBLE GO! Semua parameter (MTF, Setup, RR) dalam keadaan sempurna.";
        } else {
            verdictLabel = "GO";
            advice = "PELUANG ENTRY: Syarat teknikal dipenuhi. Sesuai untuk beli mengikut strategi.";
        }
    } else {
        verdictLabel = "WAIT";
        advice = "TUNGGU (WAIT): Menunggu kejelasan arah aliran atau 'pullback' yang lebih rapat ke MA20.";
    }

    // 5. Checklist Construction with Notes (Refined for context)
    const checklist = [
        {
            label: `Daily Score: ${score.toFixed(1)} / 10`,
            value: score >= 7.0 ? "Strong" : "Weak",
            passed: score >= 7.0,
            note: score >= 7.0 ? "Trend & Score menyokong kenaikan." : "Market dalam fasa lemah."
        },
        {
            label: "Risk/Reward Ratio (RR)",
            value: rrRatio ? rrRatio.toFixed(2) : "N/A",
            passed: rrRatio >= 2.0,
            note: rrRatio >= 2.0 ? "RR Sangat Menarik (> 2.0)" : (rrRatio >= 1.5 ? "RR Diterima" : "RR Terlalu Kecil")
        },
        {
            label: "Timeframe Alignment",
            value: `${confirmedCount}/${totalCount}`,
            passed: confirmedCount >= 2,
            note: confirmedCount === totalCount ? "MTF Aligned (Strong)" : (confirmedCount >= 2 ? "Good Alignment" : "Alignment Lemah")
        },
        {
            label: "Daily HA (Trend)",
            value: liveStock.heikinAshiGo ? "Bullish" : "Monitor",
            passed: !!liveStock.heikinAshiGo,
            note: liveStock.heikinAshiGo ? "Heikin Ashi menunjukkan momentum." : "Trend belum selaras."
        }
    ];

    // Added Logic: Check if it's actually "DOUBLE GO" candidate
    if (verdictLabel === "DOUBLE GO") {
        checklist.push({
            label: "Double Go Status",
            value: "QUALIFIED",
            passed: true,
            note: "Semua kriteria elit telah dipenuhi."
        });
    }

    // 5b. Holding Checklist (Exit/Management Focused)
    const holdingChecklist = [
        {
            label: "Target TP1 Hit?",
            value: currentPrice >= tp1 ? "REACHED" : "PENDING",
            passed: currentPrice >= tp1,
            note: currentPrice >= tp1 ? "Mula rancang Take Profit." : "Belum capai target pertama."
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
            value: currentPrice >= entry ? "SAFE" : "AT RISK",
            passed: currentPrice >= entry,
            note: currentPrice >= entry ? "Anda berada dalam zon untung." : "Masih di bawah harga belian."
        },
        {
            label: "Above MA10 Support?",
            value: stats.ma10 ? (currentPrice > stats.ma10 ? "SUPPORTED" : "BROKEN") : "N/A",
            passed: stats.ma10 ? currentPrice > stats.ma10 : true,
            note: stats.ma10 && currentPrice < stats.ma10 ? "Trend pendek mula patah." : "Trend pendek masih Bullish."
        }
    ];

    // 6. Standardized tradePlan object
    const tradePlan = {
        ticker: ticker,
        company_name: companyName || liveStock.fullName || "Unknown",
        shariah_status: shariahStatus || (liveStock.isShariah ? 'SHARIAH' : 'NON_SHARIAH') || "UNKNOWN",

        snapshotScore10: score,
        momentumScore10: momentumScore,
        verdictLabel: verdictLabel,
        convictionPct: convictionPct,

        price: currentPrice,
        currency: (market === 'MYR' || market === 'KLSE' || liveStock.market === 'MYR' || liveStock.market === 'KLSE') ? 'RM' : 'USD',
        market: market || liveStock.market || 'US',
        sentiment4h: ha4h.status === 'GO' ? 'BULLISH' : (ha4h.status === 'SELL' ? 'BEARISH' : 'NEUTRAL'),
        lastCheckedAt: analysis.lastUpdated || new Date().toISOString(),

        multiTimeframe: {
            tf15m: alignment.m15 === 'Bullish',
            tf4h: ha4h.status === 'GO' || alignment.h4 === 'Bullish',
            tf1d: !!liveStock.heikinAshiGo,
            confirmedCount: confirmedCount,
            totalCount: totalCount
        },

        indicators: {
            rsi14: stats.rsi14 || null,
            drawdownPct: (stats.dropdownPercent !== undefined ? stats.dropdownPercent : stats.drawdownPct) || null,
            ma20: stats.ma20 || null,
            ma50: stats.ma50 || null,
            ma200: stats.ma200 || null,
            atr14: stats.atr14 || null,
            stochK: stats.stoch?.k || null,
            stochD: stats.stoch?.d || null
        },

        trade: {
            strategyLabel: isBreakout ? 'Breakout Setup' : (isPullback ? 'Pullback Rebound' : 'Trend Monitoring'),
            entryTriggerText: liveStock.planText?.entryTrigger || "Menunggu isyarat harga",
            entryPrice: entry,
            stopLoss: stopPrice,
            tp1: tp1,
            tp2: tp2,
            rrRatio: rrRatio,
            queuePrice: levels.rr2_price,
            trailingStop: stats.atr14 ? (currentPrice - (1.5 * stats.atr14)) : (currentPrice * 0.96)
        },

        checklist: checklist,
        holdingChecklist: holdingChecklist,
        systemVerdictText: advice,
        raw: analysis
    };

    // Sanity Checks (Assertions)
    console.assert(tradePlan.convictionPct >= 0 && tradePlan.convictionPct <= 100, `convictionPct out of range: ${tradePlan.convictionPct}`);
    console.assert(tradePlan.snapshotScore10 >= 0 && tradePlan.snapshotScore10 <= 10, `snapshotScore10 out of range: ${tradePlan.snapshotScore10}`);
    console.assert(['AVOID', 'WAIT', 'GO', 'DOUBLE GO'].includes(tradePlan.verdictLabel), `Invalid verdictLabel: ${tradePlan.verdictLabel}`);
    console.assert(Array.isArray(tradePlan.checklist), 'Checklist must be an array');

    return tradePlan;
}
