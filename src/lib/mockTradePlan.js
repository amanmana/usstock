export const mockTradePlan = {
    ticker: "AAPL",
    company_name: "Apple Inc.",
    shariah_status: "SHARIAH",
    snapshotScore10: 8.5,
    verdictLabel: "DOUBLE GO",
    convictionPct: 95,
    price: 185.40,
    sentiment4h: "Bullish",
    lastCheckedAt: new Date().toISOString(),
    multiTimeframe: { tf15m: true, tf4h: true, tf1d: true, confirmedCount: 3, totalCount: 3 },
    indicators: {
        rsi14: 45.2,
        drawdownPct: 5.4,
        ma20: 180.20,
        ma50: 175.50,
        ma200: 160.00,
        atr14: 3.2,
        stochK: 35.5,
        stochD: 28.2
    },
    trade: {
        strategyLabel: "Rebound",
        entryTriggerText: "Melepasi MA20 (Sedia Beli)",
        entryPrice: 182.50,
        stopLoss: 175.00,
        tp1: 200.00,
        tp2: 215.00,
        rrRatio: 2.5,
        queuePrice: 182.50
    },
    checklist: [
        { label: "Macro Score: 8.5", passed: true },
        { label: "Risk/Reward: 2.5", passed: true },
        { label: "Daily HA Confirmation", passed: true },
        { label: "4H Intraday Confirmation", passed: true },
        { label: "Stoch Timing (K > D, Not OB)", passed: true }
    ]
};
