import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, BarChart2, ExternalLink, Heart, CheckCircle, Loader2, Info, AlertOctagon, Activity, RefreshCw, Bell, BellOff, Zap, Target, Clock } from 'lucide-react';
import { format } from 'date-fns';
import StockChart from './StockChart';
import { PositionManager } from './PositionManager';
import { mapAnalysisToTradePlan } from '../lib/tradePlanMapper';

const GaugeMeter = ({ value, label, color, isPortfolio, loading, variant }) => {
    // value 0-100 to angle -90 to +90
    const safeValue = Math.min(Math.max(value, 0), 100);
    const angle = (safeValue / 100) * 180 - 90;

    let labels = [];
    if (variant === 'conviction') {
        labels = ["WEAK ↓", "NEUTRAL", "OK ↑", "STRONG ⚡"];
    } else if (isPortfolio) {
        labels = ["ST. SELL", "SELL", "HOLD/SELL", "HOLD"];
    } else {
        const processedLabel = label || "";
        labels = ["AVOID", "NEUTRAL", "WAIT", processedLabel.includes("GO") ? (processedLabel.includes("DBL") ? "DBL GO" : "GO") : "GO"];
    }

    return (
        <div className={`relative flex flex-col items-center w-full max-w-[320px] mx-auto transition-opacity duration-300 ${loading ? 'opacity-40' : 'opacity-100'}`}>
            <svg width="100%" viewBox="0 0 200 120" className="overflow-visible">
                <defs>
                    {/* Defs for Text Paths */}
                    <path id="path1" d="M 15 100 A 85 85 0 0 1 39.9 39.9" />
                    <path id="path2" d="M 39.9 39.9 A 85 85 0 0 1 100 15" />
                    <path id="path3" d="M 100 15 A 85 85 0 0 1 160.1 39.9" />
                    <path id="path4" d="M 160.1 39.9 A 85 85 0 0 1 185 100" />
                </defs>

                {/* Outer Gray Track */}
                <path d="M 15 100 A 85 85 0 0 1 39.9 39.9" fill="none" stroke="#1e293b" strokeWidth="20" />
                <path d="M 39.9 39.9 A 85 85 0 0 1 100 15" fill="none" stroke="#1e293b" strokeWidth="20" />
                <path d="M 100 15 A 85 85 0 0 1 160.1 39.9" fill="none" stroke="#1e293b" strokeWidth="20" />
                <path d="M 160.1 39.9 A 85 85 0 0 1 185 100" fill="none" stroke="#1e293b" strokeWidth="20" />

                {/* Inner Colored Track */}
                <path d="M 35 100 A 65 65 0 0 1 54.04 54.04" fill="none" stroke="#ef4444" strokeWidth="20" strokeDasharray="48 100" />
                <path d="M 54.04 54.04 A 65 65 0 0 1 100 35" fill="none" stroke="#f59e0b" strokeWidth="20" strokeDasharray="48 100" />
                <path d="M 100 35 A 65 65 0 0 1 145.96 54.04" fill="none" stroke="#84cc16" strokeWidth="20" strokeDasharray="48 100" />
                <path d="M 145.96 54.04 A 65 65 0 0 1 165 100" fill="none" stroke="#22c55e" strokeWidth="20" />

                {/* Texts (Advice Categories) */}
                <text fontSize="8" fill="#94a3b8" fontWeight="800" textAnchor="middle" style={{ dominantBaseline: 'middle' }} letterSpacing="1">
                    <textPath href="#path1" startOffset="50%">{labels[0]}</textPath>
                </text>
                <text fontSize="8" fill="#94a3b8" fontWeight="800" textAnchor="middle" style={{ dominantBaseline: 'middle' }} letterSpacing="1">
                    <textPath href="#path2" startOffset="50%">{labels[1]}</textPath>
                </text>
                <text fontSize="8" fill="#94a3b8" fontWeight="800" textAnchor="middle" style={{ dominantBaseline: 'middle' }} letterSpacing="1">
                    <textPath href="#path3" startOffset="50%">{labels[2]}</textPath>
                </text>
                <text fontSize="8" fill="#94a3b8" fontWeight="800" textAnchor="middle" style={{ dominantBaseline: 'middle' }} letterSpacing="1">
                    <textPath href="#path4" startOffset="50%">{labels[3]}</textPath>
                </text>

                {/* Needle */}
                <g transform={`rotate(${angle}, 100, 100)`} className="transition-transform duration-1000 ease-in-out">
                    <path d="M 97 100 L 100 25 L 103 100 Z" fill="rgba(0,0,0,0.5)" />
                    <path d="M 98 100 L 100 15 L 102 100 Z" fill="#f8fafc" />
                    <circle cx="100" cy="100" r="8" fill="#f8fafc" />
                    <circle cx="100" cy="100" r="3" fill="#0f172a" />
                </g>
            </svg>
            <div className="mt-2 text-xs font-black uppercase tracking-wider px-6 py-2 rounded-full border border-white/10 bg-[#0f172a] text-center shadow-md min-w-[140px] flex items-center justify-center gap-2" style={{ color: color || '#f8fafc' }}>
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                {label}
            </div>
        </div>
    );
};

export function StockModal(props) {
    const {
        isOpen,
        onClose,
        stock,
        onTradeRefresh,
        strategy = 'rebound',
        favouriteTickers = [],
        favouriteDetails = {},
        onToggleFavourite,
        onToggleAlert,
        positions = {},
        onSavePosition,
        onRemovePosition,
        onSellPosition,
        onStockUpdate
    } = props;

    const formatV = (val, decimals = 3) => {
        if (val === null || val === undefined) return "—";
        const num = parseFloat(val);
        if (isNaN(num)) return "—";
        return num.toFixed(decimals);
    };

    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [tradePlan, setTradePlan] = useState(null);
    const [loadingTradePlan, setLoadingTradePlan] = useState(false);
    const [isShariahUpdating, setIsShariahUpdating] = useState(false);

    const fetchTradePlan = (ticker) => {
        if (!ticker) {
            console.warn("fetchTradePlan aborted: missing ticker");
            return;
        }
        console.log(`Fetching comprehensive trade plan for ${ticker}...`);
        setLoadingTradePlan(true);
        fetch(`/.netlify/functions/analyzeStockOnDemand?ticker=${ticker}`)
            .then(res => res.json())
            .then(data => {
                console.log("Trade plan fetch success:", data);
                if (!data.error) {
                    // Detect if the API already returned a standardized tradePlan
                    const isAlreadyPlan = data.verdictLabel && data.ticker;
                    const plan = isAlreadyPlan ? data : (data.tradePlan || mapAnalysisToTradePlan(data));
                    setTradePlan(plan);

                    // Update parent dashboard if applicable
                    if (onStockUpdate && plan) {
                        const updatedStock = {
                            ...stock,
                            close: plan.price,
                            isLivePrice: true,
                            liveScore: plan.snapshotScore10,
                            alignment: plan.multiTimeframe
                        };
                        onStockUpdate(ticker, updatedStock);
                    }
                }
                setLoadingTradePlan(false);
            })
            .catch(e => {
                console.error("Trade plan fetch error:", e);
                setLoadingTradePlan(false);
            });
    };

    const handleMarkNonShariah = () => {
        if (isShariahUpdating) return;
        setIsShariahUpdating(true);
        fetch('/.netlify/functions/updateShariahStatus', {
            method: 'POST',
            body: JSON.stringify({
                ticker: plan.ticker,
                isShariah: false
            })
        })
            .then(() => {
                fetchTradePlan(plan.ticker);
            })
            .catch(e => {
                console.error("Error marking non-shariah:", e);
            })
            .finally(() => setIsShariahUpdating(false));
    };

    useEffect(() => {
        if (stock?.ticker) {
            setLoadingHistory(true);
            fetch(`/.netlify/functions/getStockHistory?ticker=${stock.ticker}`)
                .then(res => res.json())
                .then(data => {
                    setHistoryData(data);
                    setLoadingHistory(false);
                })
                .catch(err => {
                    console.error('Failed to fetch history:', err);
                    setLoadingHistory(false);
                });

            // Fetch Trade Plan
            fetchTradePlan(stock.ticker);
        }
    }, [stock?.ticker]);


    if (!stock) return null;

    // Simplified Data Derivation
    const plan = tradePlan || {
        ticker: stock.ticker,
        company_name: stock.company,
        price: stock.close,
        shariah_status: (stock.shariah || stock.isShariah) ? 'SHARIAH' : 'NON_SHARIAH',
        snapshotScore10: parseFloat(stock.score) || 0,
        verdictLabel: "WAIT",
        convictionPct: 0,
        lastCheckedAt: new Date().toISOString(),
        multiTimeframe: stock.alignment || { confirmedCount: 0, totalCount: 1 },
        indicators: stock.stats || {},
        trade: stock.levels || {},
        checklist: []
    };

    const pos = positions[stock.ticker];
    let plAmount = pos ? (plan.price - pos.entryPrice) : 0;
    let plPercent = pos ? (plAmount / pos.entryPrice * 100) : 0;

    const generateCommentary = () => {
        const stats = plan.indicators || {};
        const rsi = parseFloat(stats.rsi14) || 50;
        const dd = parseFloat(stats.drawdownPct || stats.dropdownPercent) || 0;
        const sections = [];

        // 1. RSI Analysis
        let rsiText = "";
        if (rsi >= 70) {
            rsiText = `RSI pada tahap ${rsi.toFixed(1)} menunjukkan kaunter ini berada dalam zon **Overbought** (Terlebih Beli). Harga sudah "panas" dan risiko pembetulan (correction) adalah tinggi.`;
        } else if (rsi <= 35) {
            rsiText = `RSI pada tahap ${rsi.toFixed(1)} menunjukkan kaunter berada dalam zon **Oversold** (Terlebih Jual). Ini adalah peluang untuk mencari 'rebound' dari bawah.`;
        } else {
            rsiText = `RSI berada pada tahap ${rsi.toFixed(1)}. Momentum masih stabil/neutral, tidak terlalu mahal dan tidak terlalu murah.`;
        }
        sections.push({ title: "Analisa RSI", text: rsiText, icon: "🔥", color: rsi >= 70 ? "text-red-400" : rsi <= 35 ? "text-green-400" : "text-blue-400" });

        // 2. Drawdown Analysis
        let ddText = "";
        if (dd <= 2) {
            ddText = `Drawdown -${dd}% bermaksud harga sekarang berada di paras tertinggi (pucuk) atau baru sahaja memulakan kejatuhan. Risiko membeli di harga tertinggi adalah tinggi.`;
        } else if (dd > 15) {
            ddText = `Drawdown -${dd}% menunjukkan harga telah jatuh banyak dari puncak. Sesuai untuk mencari isyarat 'rebound' bagi pelaburan jangka sederhana.`;
        } else {
            ddText = `Drawdown -${dd}% menunjukkan berlaku 'pullback' yang sihat dari harga tertinggi.`;
        }
        sections.push({ title: "Analisa Drawdown", text: ddText, icon: "📉", color: dd <= 2 ? "text-red-400" : "text-yellow-400" });

        // 3. Score & Verdict
        let scoreText = "";
        const rrVal = plan.trade?.rrRatio || 0;

        if (plan.snapshotScore10 >= 8.5) {
            scoreText = `Skor **${plan.snapshotScore10.toFixed(1)}** (Sangat Kuat) kerana kaunter ini memenuhi hampir semua kriteria 'Trend' dan 'Uptrend' yang kita tetapkan.`;
        } else if (plan.snapshotScore10 >= 7.0) {
            scoreText = `Skor **${plan.snapshotScore10.toFixed(1)}** (Menarik) menunjukkan kedudukan teknikal yang baik untuk diperhatikan bagi kemasukan.`;
        } else {
            if (rrVal >= 2.0) {
                scoreText = `Skor **${plan.snapshotScore10.toFixed(1)}** (Pantau): Walaupun 'timing' belum sempurna (trend lemah), **Risk/Reward (${rrVal.toFixed(2)}) adalah sangat menarik**. Sangat berbaloi untuk 'que' di bawah.`;
            } else {
                scoreText = `Skor **${plan.snapshotScore10.toFixed(1)}** (Neutral/Rendah) bermakna 'timing' dan nisbah risiko-ganjaran tidak begitu menarik buat masa ini.`;
            }
        }
        sections.push({ title: "Keputusan Skor", text: scoreText, icon: "🎯", color: plan.snapshotScore10 >= 7 ? "text-primary" : (rrVal >= 2 ? "text-yellow-400" : "text-gray-400") });

        // Conclusion
        let conclusion = "";
        const rrValAtEnd = plan.trade?.rrRatio || 0;

        if (rsi >= 70 || (plan.trade.strategyLabel === 'Rebound' && dd <= 2)) {
            conclusion = `Kesimpulan: Kurang sesuai untuk strategi ${plan.trade.strategyLabel} sekarang kerana harga di paras tinggi. Tunggu 'pullback' sebelum masuk.`;
        } else if (plan.snapshotScore10 >= 7) {
            conclusion = `Kesimpulan: Sesuai untuk diperhatikan sebagai peluang ${plan.trade.strategyLabel} yang sihat. Perhatikan paras 'Entry Trigger' yang diberikan.`;
        } else if (rrValAtEnd >= 2.0) {
            conclusion = `Kesimpulan: Monitor sahaja dahulu buat masa ini. **Nisbah RR ${rrValAtEnd.toFixed(2)} sangat menarik untuk watchlist.** Tunggu pengesahan 'rebound'.`;
        } else {
            conclusion = `Kesimpulan: Elakkan (Avoid) buat masa ini sehingga skor sistem meningkat melebihi 7.0.`;
        }

        return { sections, conclusion };
    };

    const commentary = generateCommentary();

    // --- Position & Advice Logic ---
    let advice = null;

    if (pos) {
        const stats = plan.indicators || {};
        const ma10 = stats.ma10 || 0;
        const ma20 = stats.ma20 || 0;
        const ma200 = stats.ma200 || 0;
        const target1 = plan.trade.tp1 || 0;
        const stopLoss = plan.trade.stopLoss || 0;
        const isParabolic = stats.isParabolic;
        const isVolDist = stats.isVolumeDistribution;
        const stochSell = stats.stochSell;

        // 1. Tanda Bahaya (Exit Segera)
        const h4RedConf = plan.multiTimeframe.tf4h === false && plan.multiTimeframe.confirmedCount === 0; // Simplified check
        const h4StochCollapse = stats.stochCollapse;

        if (h4RedConf && h4StochCollapse) {
            advice = {
                type: 'sell',
                text: `EXIT CONFIRMED (4H): 2x Lilin HA Merah + Stochastic Cross Down di zon tinggi. Syarat jualan anda telah dipenuhi. EXIT SEGERA.`,
                color: "text-red-500 font-black"
            };
        } else if (plan.price < ma200 && ma200 > 0) {
            advice = {
                type: 'sell',
                text: `DANGER: Trend Jangka Panjang Patah (Bawah MA200). Kriteria teknikal terbatal. EXIT SEGERA untuk lindungi baki modal.`,
                color: "text-red-500 font-black"
            };
        } else if (isVolDist) {
            advice = {
                type: 'sell',
                text: `DANGER: Volume Distribution! Harga jatuh dengan volume luar biasa tinggi. EXIT SEGERA.`,
                color: "text-red-500 font-black"
            };
        }
        // 2. Jual Semasa Kuat (Take Profit)
        else if (isParabolic) {
            advice = {
                type: 'sell',
                text: `PARABOLIK: Harga melonjak terlalu jauh dari MA10 (>10% gap). Risiko pullback mendadak tinggi. Cadangan: JUAL SEBAHAGIAN untuk kunci untung.`,
                color: "text-orange-400 font-bold"
            };
        } else if (stochSell) {
            advice = {
                type: 'sell',
                text: `STOCHASTIC SELL: %K silang bawah %D di zon Overbought. Momentum mula melemah. Cadangan: AMBIL UNTUNG sebahagian.`,
                color: "text-orange-400"
            };
        } else if (plPercent >= 10 && plPercent < 20) {
            advice = {
                type: 'tp',
                text: `SASARAN TP1 TERCAPAI (+${plPercent.toFixed(1)}%). Cadangan: JUAL 50% untuk kunci untung dan biarkan baki 'run' dengan Trailing Stop.`,
                color: "text-emerald-400 font-bold"
            };
        }
        // 3. Lindung Modal & Trend
        else if (plan.price < ma10 && ma10 > 0) {
            advice = {
                type: 'sell',
                text: `Trend Pendek Melemah: Harga tutup bawah MA10 (USD ${ma10.toFixed(3)}). Cadangan: KELUAR sepenuhnya atau sebahagian untuk selamatkan untung.`,
                color: "text-yellow-500"
            };
        } else if (plPercent >= 5) {
            advice = {
                type: 'hold',
                text: `MODAL DILINDUNGI: Untung sudah >5%. Gerakkan Stop Loss ke Harga Belian (USD ${pos.entryPrice.toFixed(3)}) untuk 'Risk Free Trade'.`,
                color: "text-indigo-400"
            };
        } else if (plan.price <= stopLoss) {
            advice = {
                type: 'sell',
                text: `STOP LOSS HIT: Harga (USD ${plan.price.toFixed(3)}) bocor paras sokongan (USD ${stopLoss.toFixed(3)}). KELUAR SEGERA.`,
                color: "text-red-400"
            };
        }
        // Default Hold
        else {
            const lowIntraday = plan.multiTimeframe.confirmedCount === 0;
            const strategyText = plan.trade.strategyLabel === 'Momentum' ? `Kekal atas MA20 (USD ${ma20.toFixed(3)})` : `Masih dalam zon sihat`;
            advice = {
                type: 'hold',
                text: lowIntraday
                    ? `HOLD (AMARAN): Sentiment intraday lemah (0/3). Masih ${strategyText}. Pantau rapi paras USD ${stopLoss.toFixed(3)}.`
                    : `HOLD: ${strategyText}. Sasaran TP1 seterusnya adalah USD ${target1.toFixed(3)}. Teruskan 'ride' selagi trend belum patah.`,
                color: lowIntraday ? "text-orange-400" : "text-blue-400"
            };
        }
    }


    const isFav = favouriteTickers?.includes(stock.ticker) || (stock.ticker_full && favouriteTickers?.includes(stock.ticker_full));



    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-surface border border-white/5 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl animate-in fade-in zoom-in duration-300 overflow-hidden relative">

                {/* Reject Reason Header */}
                {plan.raw?.rejectReason && (
                    <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex items-center gap-3 animate-pulse">
                        <AlertOctagon className="w-5 h-5 text-red-400" />
                        <span className="text-red-400 text-xs font-black uppercase tracking-widest">
                            PERHATIAN: {plan.raw.rejectReason}
                        </span>
                    </div>
                )}

                {/* Header - Sticky */}
                <div className="sticky top-0 z-30 flex items-center justify-between p-6 md:p-8 border-b border-white/5 bg-surfaceHighlight/50 backdrop-blur-xl">
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                {plan.company_name} <span className="text-gray-400 text-lg">({plan.ticker})</span>
                            </h2>
                            <button
                                onClick={() => onToggleFavourite(stock.ticker_full || stock.ticker)}
                                className={`p-1.5 rounded-lg transition-all ${isFav ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-500/5'}`}
                                title={isFav ? "Remove from Favourites" : "Add to Favourites"}
                            >
                                <Heart className={`w-5 h-5 ${isFav ? 'fill-current' : ''}`} />
                            </button>
                            {/* Shariah Status Toggle */}
                            <button
                                onClick={() => handleMarkNonShariah()}
                                disabled={isShariahUpdating}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${isShariahUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'} ${plan.shariah_status === 'SHARIAH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
                            >
                                {isShariahUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertOctagon className="w-3 h-3" />}
                                {plan.shariah_status === 'SHARIAH' ? 'SHARIAH' : 'BUKAN SHARIAH?'}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-3xl font-black ${pos ? (plPercent >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-primary'}`}>
                                {pos ? `${plPercent >= 0 ? '+' : ''}${plPercent.toFixed(1)}%` : `SNAPSHOT: ${plan.snapshotScore10.toFixed(1)}`}
                            </span>
                            {!pos && <span className="text-sm text-gray-500 font-bold uppercase tracking-widest ml-1"> / 10</span>}
                            {pos && (
                                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-white/10">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">PL (USD)</span>
                                        <span className={`text-sm font-black ${plAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {plAmount >= 0 ? '+' : ''}${(plAmount * (pos.quantity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Entry</span>
                                        <span className="text-xs text-white font-bold">USD {pos.entryPrice.toFixed(3)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-white/10 rounded-2xl transition-all shrink-0 hover:rotate-90 duration-300"
                    >
                        <X className="w-6 h-6 text-gray-500 hover:text-white" />
                    </button>
                </div>

                {/* Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scroll-smooth scrollbar-thin scrollbar-thumb-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        {/* Column 1: Analysis & Management (Why/How) */}
                        <div className="space-y-6">
                            {/* Real-time Decision Support */}
                            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 rounded-2xl p-5 border border-indigo-500/20 shadow-xl overflow-hidden relative group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                    <Activity className="w-12 h-12 text-indigo-400" />
                                </div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[11px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4" /> Real-time Decision Support
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => fetchTradePlan(plan.ticker)}
                                            disabled={loadingTradePlan}
                                            className="p-1.5 rounded-lg bg-white/5 text-indigo-300/60 hover:text-indigo-300 hover:bg-white/10 transition-all active:scale-90 disabled:opacity-50"
                                            title="Refresh Intraday Data"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${loadingTradePlan ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {loadingTradePlan && !tradePlan ? (
                                    <div className="space-y-4 py-4 flex flex-col items-center">
                                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                                        <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest animate-pulse">Analysing Live Signals...</div>
                                    </div>
                                ) : plan.multiTimeframe ? (
                                    <div className="space-y-4">
                                        {/* MTF Alignment Traffic Lights */}
                                        <div className="flex items-center gap-4 py-2 border-b border-white/5">
                                            <div className="flex flex-col gap-1 items-center">
                                                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">15m</span>
                                                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${plan.multiTimeframe.tf15m ? 'bg-emerald-500 shadow-emerald-500/50' : (plan.multiTimeframe.m15 === 'Bearish' ? 'bg-red-500 shadow-red-500/50' : 'bg-gray-500 shadow-gray-500/50')}`}></div>
                                            </div>
                                            <div className="flex flex-col gap-1 items-center">
                                                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">4H</span>
                                                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${plan.multiTimeframe.tf4h ? 'bg-emerald-500 shadow-emerald-500/50' : (plan.multiTimeframe.h4 === 'Bearish' ? 'bg-red-500 shadow-red-500/50' : 'bg-gray-500 shadow-gray-500/50')}`}></div>
                                            </div>
                                            <div className="flex flex-col gap-1 items-center">
                                                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">1D</span>
                                                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${plan.multiTimeframe.tf1d ? 'bg-emerald-500 shadow-emerald-500/50' : (plan.multiTimeframe.d1 === 'Bearish' ? 'bg-red-500 shadow-red-500/50' : 'bg-gray-500 shadow-gray-500/50')}`}></div>
                                            </div>
                                            <div className="h-6 w-px bg-white/10 ml-2"></div>
                                            <div className="flex-1 flex flex-col">
                                                <span className="text-[8px] font-bold text-gray-500 uppercase">{plan.multiTimeframe.totalCount > 1 ? 'Multi-Timeframe Alignment' : 'Daily Alignment Only'}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-black ${(plan.multiTimeframe.confirmedCount >= 2 || (plan.multiTimeframe.totalCount === 1 && plan.multiTimeframe.confirmedCount === 1)) ? 'text-emerald-400' : 'text-gray-400'}`}>
                                                        {plan.multiTimeframe.confirmedCount} / {plan.multiTimeframe.totalCount} Confirmed
                                                    </span>
                                                    {plan.multiTimeframe.confirmedCount === plan.multiTimeframe.totalCount && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`p-3 rounded-xl border-l-4 ${plan.verdictLabel?.includes('GO') ? 'bg-emerald-500/10 border-emerald-500/50' : (plan.verdictLabel === 'AVOID' || plan.verdictLabel?.includes('SELL') ? 'bg-red-500/10 border-red-500/50' : 'bg-indigo-500/10 border-indigo-500/50')}`}>
                                            <p className="text-[13px] text-white leading-relaxed font-bold">
                                                {plan.raw?.advice || "Tiada data intraday buat masa ini."}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest leading-none mb-1 text-center">Price</span>
                                                    <span className="text-white font-black text-sm">USD {(parseFloat(plan.price) || 0).toFixed(3)}</span>
                                                </div>
                                                <div className="flex flex-col border-l border-white/10 pl-3">
                                                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest leading-none mb-1 text-center">Sentiment 4H</span>
                                                    <span className={`text-sm font-black text-center ${plan.sentiment4h === 'Bullish' || plan.sentiment4h === 'Green' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {plan.sentiment4h?.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-60">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">Last Checked</span>
                                                    <span className="text-[9px] text-white font-black text-mono">
                                                        {format(new Date(plan.lastCheckedAt), 'HH:mm:ss')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-indigo-300/60 italic py-2 text-center animate-pulse">
                                        Data live sedang dijana secara automatik. Sila tunggu...
                                    </div>
                                )}
                            </div>

                            {/* Position Management */}
                            <PositionManager
                                ticker={plan.ticker}
                                currentPrice={plan.price}
                                market={stock.market || 'USD'}
                                existingPosition={pos}
                                technicalLevels={plan.trade}
                                recommendedStrategy={plan.trade.strategyLabel?.toLowerCase()}
                                onSave={(data) => onSavePosition(plan.ticker, data)}
                                onRemove={onRemovePosition}
                                onSell={(data) => pos && onSellPosition({ ...data, ticker_full: plan.ticker, entry_price: pos.entryPrice, strategy: pos.strategy, buy_date: pos.buyDate })}
                            />

                            {/* Automated Commentary Section */}
                            <div className="bg-surfaceHighlight/30 rounded-xl p-5 border border-border space-y-4">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-primary" /> Ulasan Teknikal (Automatik)
                                </h3>
                                <div className="space-y-4">
                                    {commentary.sections.map((sec, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className={`text-[11px] font-bold uppercase flex items-center gap-1.5 ${sec.color}`}>
                                                <span>{sec.icon}</span> {sec.title}
                                            </div>
                                            <p className="text-xs text-gray-400 leading-relaxed">
                                                {(sec.text || "").split('**').map((part, i) => i % 2 === 1 ? <b key={i} className="text-white">{part}</b> : part)}
                                            </p>
                                        </div>
                                    ))}
                                    <div className="pt-3 border-t border-white/5">
                                        <p className="text-[13px] font-bold text-primary leading-snug italic">
                                            {commentary.conclusion}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Support & Resistance Table */}
                            <div className="bg-background rounded-2xl border border-white/5 overflow-hidden">
                                <div className="p-4 bg-surfaceHighlight/30 border-b border-white/5 text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Target className="w-3 h-3" /> Moving Averages
                                </div>
                                <table className="w-full text-xs text-left">
                                    <tbody className="divide-y divide-white/5">
                                        <tr className="group hover:bg-white/5">
                                            <td className="p-3 text-gray-500 font-bold uppercase tracking-tighter">MA 20 (Short)</td>
                                            <td className="p-3 text-right font-mono text-white font-black">{formatV(plan.indicators.ma20)}</td>
                                        </tr>
                                        <tr className="group hover:bg-white/5">
                                            <td className="p-3 text-gray-500 font-bold uppercase tracking-tighter">MA 50 (Med)</td>
                                            <td className="p-3 text-right font-mono text-white font-black">{formatV(plan.indicators.ma50)}</td>
                                        </tr>
                                        <tr className="group hover:bg-white/5">
                                            <td className="p-3 text-gray-500 font-bold uppercase tracking-tighter">MA 200 (Long)</td>
                                            <td className="p-3 text-right font-mono text-white font-black">{formatV(plan.indicators.ma200)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Stock Chart Section */}
                            <div className="space-y-3">
                                {loadingHistory ? (
                                    <div className="h-48 flex flex-col items-center justify-center bg-surfaceHighlight/20 rounded-lg border border-border animate-pulse gap-2">
                                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Loading Chart Data...</span>
                                    </div>
                                ) : (
                                    <StockChart data={historyData} />
                                )}
                            </div>
                        </div>

                        {/* Column 2: The Verdict (Action) */}
                        <div className="space-y-6">

                            {/* Recommendation Card */}
                            {(() => {
                                const verdict = plan.verdictLabel;
                                const conviction = plan.convictionPct;
                                const rrNum = plan.trade.rrRatio || 0;

                                let vColor = "bg-gray-500/10 text-gray-400 border-gray-500/20";
                                let vIcon = <Activity className="w-5 h-5" />;
                                let vDesc = plan.systemVerdictText || "Isyarat belum cukup kuat untuk keputusan beli. Tunggu 'alignment' berlaku.";

                                if (pos) {
                                    if (verdict === 'ST. SELL' || verdict === 'SELL') {
                                        vColor = "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/40 font-black";
                                        vIcon = <AlertOctagon className="w-5 h-5" />;
                                        vDesc = "SENTIMEN BURUK: Risiko kejatuhan lanjut tinggi. Cadangan EXIT segera.";
                                    } else if (verdict === 'HOLD/SELL') {
                                        vColor = "bg-orange-500/20 text-orange-400 border-orange-400/30";
                                        vIcon = <Activity className="w-5 h-5" />;
                                        vDesc = "Trend mula melemah. Ambil sebahagian untung untuk kunci modal.";
                                    } else {
                                        vColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                                        vIcon = <CheckCircle className="w-5 h-5" />;
                                        vDesc = "Trend masih kukuh. Teruskan 'ride' selagi isyarat exit belum muncul.";
                                    }
                                } else {
                                    if (verdict === "DOUBLE GO") {
                                        vColor = "bg-emerald-500 text-black border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)] font-black";
                                        vIcon = <Zap className="w-5 h-5 fill-black" />;
                                        vDesc = "Peluang Terbaik: Macro & Intraday sejajar. Kebangkalian 'follow-through' sangat tinggi.";
                                    } else if (verdict === "GO" || verdict === "GO / BUY") {
                                        vColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-emerald-500/5 font-black";
                                        vIcon = <TrendingUp className="w-5 h-5" />;
                                        vDesc = "Isyarat cukup syarat untuk entri mengikut strategi.";
                                    } else if (verdict === "WAIT" || verdict === "WAIT / MONITOR") {
                                        vColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                                        vIcon = <Activity className="w-5 h-5" />;
                                        vDesc = "Hampir bersedia. Tunggu 'price action' yang lebih jelas.";
                                    } else {
                                        vColor = "bg-red-500/10 text-red-500 border-red-500/20";
                                        vIcon = <AlertOctagon className="w-5 h-5" />;
                                        vDesc = "Nisbah risiko-ganjaran tidak menarik. Lebihkan tunai.";
                                    }
                                }

                                // Gauge Value Calculation
                                let verdictValue = 37.5;
                                if (verdict === "DOUBLE GO" || verdict === "GO" || verdict === "GO / BUY" || verdict === "HOLD") verdictValue = 87.5;
                                else if (verdict === "WAIT" || verdict === "WAIT / MONITOR" || verdict === "HOLD/SELL") verdictValue = 62.5;
                                else if (verdict === "AVOID" || verdict === "SELL" || verdict === "ST. SELL") verdictValue = 12.5;

                                // Alignment Logic for Sub-advice
                                const rawAlign = plan.raw?.alignment || {};
                                const rDays = rawAlign.rallyDays || 0;
                                const pDays = rawAlign.pullbackDays || 0;
                                let subAdvice = null;
                                let subColor = "text-blue-400";

                                if (rDays > 0) {
                                    if (rDays <= 2) {
                                        if (rrNum < 1.5) {
                                            subAdvice = `Rally baru bermula (${rDays}H) TAPI RR rendah (${rrNum?.toFixed(2)}). Berisiko untuk 'chasing', lebih baik tunggu pullback.`;
                                            subColor = "text-orange-400";
                                        } else {
                                            subAdvice = `Fasa Breakout Awal (${rDays}H). RR sangat menarik (${rrNum?.toFixed(2)}). Peluang masuk berkualiti.`;
                                            subColor = "text-emerald-400";
                                        }
                                    } else if (rDays === 3) {
                                        subAdvice = `Trend 3 hari sudah sah. Waktu terbaik untuk Swing dengan RR ${rrNum?.toFixed(2)}.`;
                                        subColor = "text-emerald-400";
                                    } else {
                                        subAdvice = `Overextended! Rally sudah ${rDays} hari. Elak FOMO kerana risiko jualan tiba-tiba tinggi.`;
                                        subColor = "text-orange-400";
                                    }
                                } else if (pDays > 0) {
                                    if (pDays <= 2) {
                                        subAdvice = `Pullback Sihat (${pDays}H). Perhatikan jika harga bertahan di atas Support. RR: ${rrNum?.toFixed(2)}.`;
                                        subColor = "text-orange-400";
                                    } else {
                                        subAdvice = `Trend Jualan Kuat (${pDays}H). Elak 'tangkap pisau jatuh'. Tunggu isyarat rebound.`;
                                        subColor = "text-red-400";
                                    }
                                }

                                const ChecklistItem = ({ checked, label }) => (
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${checked ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-600'}`}>
                                            {checked ? <CheckCircle className="w-2.5 h-2.5" /> : <div className="w-1 h-1 rounded-full bg-gray-600"></div>}
                                        </div>
                                        <span className={`text-[10px] font-bold ${checked ? 'text-gray-200' : 'text-gray-500'}`}>{label}</span>
                                    </div>
                                );

                                return (
                                    <>
                                        {/* Technical Gauges Section */}
                                        <div className="relative group overflow-hidden bg-surfaceHighlight/30 rounded-2xl p-6 border border-white/5 flex flex-col items-center">
                                            {loadingTradePlan && (
                                                <div className="absolute inset-0 z-[20] flex flex-col items-center justify-center bg-background/40 backdrop-blur-sm rounded-2xl transition-all duration-300">
                                                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                                                    <span className="text-[9px] font-black text-white uppercase tracking-[0.15em] animate-pulse">Recalculating</span>
                                                </div>
                                            )}
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Technical Decision</h4>
                                            <div className="w-full flex justify-center mb-4">
                                                <GaugeMeter
                                                    value={verdictValue}
                                                    label={verdict}
                                                    isPortfolio={false}
                                                    color={vColor?.includes('emerald') ? '#10b981' : (vColor?.includes('red') ? '#ef4444' : (vColor?.includes('orange') || vColor?.includes('yellow') ? '#fbbf24' : '#94a3b8'))}
                                                    loading={loadingTradePlan}
                                                />
                                            </div>

                                            <div className="w-full flex justify-center mb-4">
                                                {pos?.quantity > 0 ? (
                                                    /* Portfolio Action Gauge */
                                                    <GaugeMeter
                                                        value={verdictValue}
                                                        label="POSITION ACTION"
                                                        isPortfolio={true}
                                                        color="#6366f1"
                                                        loading={loadingTradePlan}
                                                    />
                                                ) : (
                                                    /* Standard Conviction Gauge */
                                                    <GaugeMeter
                                                        value={plan.convictionPct}
                                                        label="CONVICTION"
                                                        variant="conviction"
                                                        color="#6366f1"
                                                        loading={loadingTradePlan}
                                                    />
                                                )}
                                            </div>

                                            {/* Status Boxes */}
                                            {/* RSI Box */}
                                            <div className="w-full grid grid-cols-2 gap-4 mt-4">
                                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-all">
                                                    <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">RSI (14)</div>
                                                    <div className="flex items-end gap-2">
                                                        <span className={`text-xl font-black ${parseFloat(plan.indicators.rsi14) >= 70 ? 'text-red-400' : (parseFloat(plan.indicators.rsi14) <= 35 ? 'text-emerald-400' : 'text-white')}`}>
                                                            {formatV(plan.indicators.rsi14, 1)}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 font-bold mb-1 uppercase">{parseFloat(plan.indicators.rsi14) >= 70 ? 'O/Bought' : (parseFloat(plan.indicators.rsi14) <= 35 ? 'O/Sold' : 'Neutral')}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-all">
                                                    <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Daily Alignment</div>
                                                    <div className="flex items-end gap-2">
                                                        <span className={`text-xl font-black ${plan.multiTimeframe.tf1d ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {plan.multiTimeframe.tf1d ? 'ALIGNED' : 'WEAK'}
                                                        </span>
                                                        <div className={`w-2 h-2 rounded-full mb-2 ${plan.multiTimeframe.tf1d ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Checklist Section */}
                                            <div className="w-full space-y-3 mt-6">
                                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Double Go Checklist
                                                </h4>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {plan.checklist.map((item, idx) => (
                                                        <div key={idx} className={`flex flex-col p-3 rounded-xl border transition-all ${item.passed ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`p-1 rounded-lg ${item.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                        {item.passed ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                                                    </div>
                                                                    <span className={`text-[10px] font-bold ${item.passed ? 'text-gray-200' : 'text-red-300'}`}>
                                                                        {item.label}
                                                                    </span>
                                                                </div>
                                                                <span className={`text-[10px] font-black mono ${item.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                    {item.value}
                                                                </span>
                                                            </div>
                                                            {item.note && (
                                                                <div className="text-[9px] text-gray-500 font-medium pl-6">
                                                                    {item.note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Wait for RR 2.0 Pricing Notice - Only show if NO active position */}
                                            {!pos && plan.trade?.queuePrice && parseFloat(plan.price) > parseFloat(plan.trade.queuePrice) && (
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden group/notice animate-in zoom-in-95 duration-500">
                                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                                        <Clock className="w-12 h-12 text-emerald-400" />
                                                    </div>
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Wait for RR 2.0 @</span>
                                                                <Clock className="w-3 h-3 text-emerald-500 animate-pulse" />
                                                            </div>
                                                            <div className="text-3xl font-black text-emerald-400 tracking-tighter">
                                                                USD {parseFloat(plan.trade.queuePrice).toFixed(3)}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Que Price</span>
                                                            <div className="bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-xl border border-emerald-500/30 font-black text-[10px] uppercase tracking-tighter">
                                                                (Advantage)
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Main Verdict Card */}
                                        <div className={`p-6 rounded-3xl border shadow-2xl transition-all duration-500 ${plan.verdictLabel?.includes('GO') ? 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10' : (plan.verdictLabel === 'AVOID' ? 'bg-red-500/10 border-red-500/20 shadow-red-500/10' : 'bg-primary/10 border-primary/20 shadow-primary/10')}`}>
                                            <div className="flex flex-col gap-6">
                                                <div className="flex items-center gap-5">
                                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-3 ${plan.verdictLabel?.includes('GO') ? 'bg-emerald-500 text-white' : (plan.verdictLabel === 'AVOID' ? 'bg-red-500 text-white' : 'bg-primary text-white')}`}>
                                                        {plan.verdictLabel?.includes('GO') ? <TrendingUp className="w-8 h-8" /> : (plan.verdictLabel === 'AVOID' ? <TrendingDown className="w-8 h-8" /> : <Activity className="w-8 h-8" />)}
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">System Verdict</div>
                                                        <div className={`text-3xl font-black tracking-tighter ${plan.verdictLabel?.includes('GO') ? 'text-emerald-400' : (plan.verdictLabel === 'AVOID' ? 'text-red-400' : 'text-primary')}`}>
                                                            {plan.verdictLabel}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action Advice */}
                                                <div className="w-full">
                                                    <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                                                        <div className="flex items-start gap-3">
                                                            <div className="mt-1">
                                                                {plan.verdictLabel?.includes('GO') ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Info className="w-4 h-4 text-primary" />}
                                                            </div>
                                                            <div>
                                                                <p className="text-[13px] font-bold text-white leading-relaxed">
                                                                    {vDesc}
                                                                </p>
                                                                {plan.trade.strategyLabel && (
                                                                    <div className="mt-2 inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                                        Strategy: {plan.trade.strategyLabel}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Signal Badges */}
                                        <div className="mt-5 flex flex-wrap gap-2 relative z-10">
                                            {plan.indicators.rsi14 < 35 && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/20 font-black uppercase tracking-tighter shadow-sm">Oversold</span>}
                                            {plan.raw?.liveStock?.isMinervini && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-lg border border-indigo-500/20 font-black uppercase tracking-tighter shadow-sm">Minervini</span>}
                                            {plan.multiTimeframe.confirmedCount === 3 && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-lg border border-yellow-500/20 font-black uppercase tracking-tighter shadow-sm">MTF Alignment</span>}
                                        </div>
                                    </>
                                );
                            })()}


                            {/* Smart Alert Section */}
                            {(plan.raw?.liveStock?.isMASupport || stock.isMASupport) && (
                                <div className="bg-cyan-500/5 rounded-2xl p-5 border border-cyan-500/10 flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                                    <div>
                                        <div className="font-black text-cyan-400 uppercase text-[10px] tracking-widest mb-1">Mean Reversion (MA Support)</div>
                                        <div className="text-[11px] text-gray-400 leading-relaxed font-medium">Harga sedang melantun atau bertahan di atas garisan purata (MA50/MA200). Ini menunjukkan sokongan dinamik yang kuat.</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Trade Setup Strategy */}
                    {(plan.raw?.liveStock?.planText || stock.planText) && (
                        <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20">
                            <h3 className="text-xs font-black text-primary mb-5 flex items-center gap-2 uppercase tracking-widest">
                                <CheckCircle className="w-4 h-4" /> Pelan Dagangan Swing
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-gray-500 uppercase font-black block mb-1.5 tracking-widest">Entry Trigger</label>
                                        <div className="text-sm text-white font-bold leading-relaxed">{plan.raw?.liveStock?.planText?.entryTrigger || stock.planText?.entryTrigger}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-black block mb-1.5 tracking-widest">Target 1 (TP)</label>
                                            <div className="text-xl font-black text-emerald-400">USD {(plan.trade?.tp1 || stock.levels?.target1 || 0).toFixed(3)}</div>
                                            <div className="text-[10px] text-emerald-500/60 font-bold">+{(((plan.trade?.tp1 || stock.levels?.target1 || 0) - plan.price) / plan.price * 100).toFixed(1)}% Potensi</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-black block mb-1.5 tracking-widest">Stop Loss (Exit)</label>
                                            <div className="text-xl font-black text-red-400">USD {(plan.trade?.stopLoss || stock.levels?.stopPrice || 0).toFixed(3)}</div>
                                            <div className="text-[10px] text-red-500/60 font-bold">Risk: {((plan.price - (plan.trade?.stopLoss || stock.levels?.stopPrice || 0)) / plan.price * 100).toFixed(1)}%</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col justify-center items-center text-center">
                                    <div className="text-[10px] text-gray-500 uppercase font-black mb-2 tracking-widest">RR Ratio Status</div>
                                    <div className={`text-3xl font-black mb-1 ${(plan.trade?.rrRatio || stock.levels?.rr1 || 0) >= 2.0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                        {(plan.trade?.rrRatio || stock.levels?.rr1 || 0).toFixed(2)}
                                    </div>
                                    <div className="text-[9px] text-gray-500 font-bold uppercase">Risk Reward Ratio</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - Sticky Bottom */}
                <div className="sticky bottom-0 z-30 p-6 md:p-8 border-t border-white/5 bg-surfaceHighlight/50 backdrop-blur-xl flex justify-between items-center shrink-0">
                    <a
                        href={`https://www.tradingview.com/chart/?symbol=${(plan.ticker || "").split('.')[0]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[10px] md:text-xs font-black text-gray-400 hover:text-white uppercase tracking-widest transition-all bg-white/5 hover:bg-white/10 px-6 py-3 rounded-xl border border-white/5"
                    >
                        <ExternalLink className="w-4 h-4 text-primary" /> Open in TradingView
                    </a>

                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-white text-black hover:bg-gray-200 rounded-xl transition-all text-xs font-black uppercase tracking-widest shadow-xl active:scale-95"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
};
