import React, { useState, useEffect } from 'react';
import { X, TrendingUp, BarChart2, ExternalLink, Heart, CheckCircle, Loader2, Info, AlertOctagon, Activity, RefreshCw, Bell, BellOff } from 'lucide-react';
import { format } from 'date-fns';
import StockChart from './StockChart';
import { PositionManager } from './PositionManager';

const GaugeMeter = ({ value, label, color }) => {
    const angle = (value / 100) * 180 - 90;

    // Determine color scale for the gradient
    return (
        <div className="relative flex flex-col items-center w-full max-w-[120px]">
            <svg width="100%" viewBox="0 0 100 55" className="overflow-visible">
                <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="50%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                </defs>
                {/* Background Arc */}
                <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="8"
                    strokeLinecap="round"
                />
                {/* Colored Track */}
                <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="125.66"
                    strokeDashoffset={125.66}
                    className="opacity-10"
                />
                {/* Active Segment Dot/Line (Optional visual polish) */}
                <circle cx="50" cy="50" r="41" fill="none" stroke={color} strokeWidth="1" strokeDasharray="1, 8" className="opacity-30" />

                {/* Needle */}
                <g transform={`rotate(${angle}, 50, 50)`} className="transition-transform duration-1000 ease-out">
                    <line x1="50" y1="50" x2="50" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="3.5" fill="white" />
                </g>
            </svg>
            <div className={`text-[10px] font-black uppercase tracking-wider mt-2 px-3 py-0.5 rounded-full border border-white/5 bg-white/5 text-center truncate w-full shadow-lg transition-colors duration-500`} style={{ color: color }}>
                {label}
            </div>
        </div>
    );
};

export function StockModal({ stock, onClose, strategy = 'rebound', favouriteTickers = [], favouriteDetails = {}, onToggleFavourite, onToggleAlert, positions = {}, onSavePosition, onRemovePosition, onSellPosition }) {
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [intradayAnalysis, setIntradayAnalysis] = useState(null);
    const [loadingIntraday, setLoadingIntraday] = useState(false);

    const fetchIntraday = (ticker, pos) => {
        if (!ticker) {
            console.warn("fetchIntraday aborted: missing ticker");
            return;
        }
        console.log(`Refreshing intraday for ${ticker}...`);
        setLoadingIntraday(true);
        fetch('/.netlify/functions/getIntradayAnalysis', {
            method: 'POST',
            body: JSON.stringify({
                ticker: ticker,
                entryPrice: pos?.entryPrice || null
            })
        })
            .then(res => res.json())
            .then(data => {
                console.log("Intraday refresh success:", data);
                if (!data.error) setIntradayAnalysis(data);
                setLoadingIntraday(false);
            })
            .catch(e => {
                console.error("Intraday fetch error:", e);
                setLoadingIntraday(false);
            });
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

            // Fetch Intraday Analysis for all cases (Rally/Pullback tracking)
            const pos = positions[stock.ticker];
            fetchIntraday(stock.ticker, pos);
        }
    }, [stock?.ticker, positions]);


    if (!stock) return null;

    const momentumScore = parseFloat(stock.momentumScore) || 0;
    const reboundScore = parseFloat(stock.score) || 0;
    const isHybrid = strategy === 'hybrid';
    const isMomentumMode = isHybrid ? (momentumScore > reboundScore) : (strategy === 'momentum');
    const score = isMomentumMode ? momentumScore : reboundScore;

    const generateCommentary = () => {
        const stats = stock.stats || {};
        const rsi = parseFloat(stats.rsi14) || 50;
        const dd = parseFloat(stats.dropdownPercent) || 0;
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
        if (score >= 8.5) {
            scoreText = `Skor ${score.toFixed(1)} (Sangat Kuat) kerana kaunter ini memenuhi hampir semua kriteria '${isMomentumMode ? 'Momentum' : 'Rebound'}' dan 'Uptrend' yang kita tetapkan.`;
        } else if (score >= 7.0) {
            scoreText = `Skor ${score.toFixed(1)} (Menarik) menunjukkan kedudukan teknikal yang baik untuk diperhatikan bagi kemasukan ${isMomentumMode ? 'momentum' : 'pullback'}.`;
        } else {
            scoreText = `Skor ${score.toFixed(1)} (Neutral/Rendah) bermakna nisbah risiko-ganjaran (risk-reward) tidak begitu menarik buat masa ini.`;
        }
        sections.push({ title: "Keputusan Skor", text: scoreText, icon: "🎯", color: score >= 7 ? "text-primary" : "text-gray-400" });

        // Conclusion
        let conclusion = "";
        if (rsi >= 70 || (strategy === 'rebound' && dd <= 2)) {
            conclusion = `Kesimpulan: Kurang sesuai untuk strategi ${isMomentumMode ? 'Momentum' : 'Rebound'} sekarang kerana harga di paras tinggi. Tunggu 'pullback' (RSI turun bawah 50 dan DD lebih besar) sebelum masuk.`;
        } else if (score >= 7) {
            conclusion = `Kesimpulan: Sesuai untuk diperhatikan sebagai peluang ${isMomentumMode ? 'Momentum' : 'Rebound/Pullback'} yang sihat. Perhatikan paras 'Entry Trigger' yang diberikan.`;
        } else {
            conclusion = `Kesimpulan: Monitor sahaja dahulu buat masa ini. Tunggu sehingga skor sistem meningkat melebihi 7.0.`;
        }

        return { sections, conclusion };
    };

    const commentary = generateCommentary();

    // --- Position & Advice Logic ---
    const pos = positions[stock.ticker];
    let advice = null;
    let plAmount = 0;
    let plPercent = 0;

    if (pos) {
        plAmount = stock.close - pos.entryPrice;
        plPercent = (plAmount / pos.entryPrice) * 100;
        const totalPLRM = plAmount * (pos.quantity || 0);

        if (pos.strategy === 'rebound') {
            const target1 = stock.levels?.target1 || 0;
            const stopLoss = stock.levels?.stopPrice || 0;
            // 2 bid adjustment helper
            const bidStep = target1 >= 1.00 ? 0.01 : 0.005;
            const targetSafe = target1 - (2 * bidStep);

            if (stock.close >= target1) {
                advice = {
                    type: 'sell',
                    text: `Target 1 (RM ${target1.toFixed(3)}) Tercapai! Cadangan JUAL (Ambil Untung) atau gerakkan Stop Loss ke RM ${pos.entryPrice.toFixed(3)} untuk lindungi modal.`,
                    color: "text-emerald-400"
                };
            } else if (stock.close <= stopLoss) {
                advice = {
                    type: 'sell',
                    text: `Harga (RM ${stock.close.toFixed(3)}) sudah berada di paras Stop Loss (RM ${stopLoss.toFixed(3)}). Cadangan JUAL segera untuk kawal kerugian.`,
                    color: "text-red-400"
                };
            } else {
                advice = {
                    type: 'hold',
                    text: `HOLD: Masih dalam zon pullback. Sasaran terdekat adalah Target 1 (RM ${target1.toFixed(3)}). Set harga jual 2 bid di bawah sasaran iaitu RM ${targetSafe.toFixed(3)} (Auto-Sell). Stop Loss: RM ${stopLoss.toFixed(3)}.`,
                    color: "text-blue-400"
                };
            }
        } else {
            const ma20 = stock.stats?.ma20 || 0;
            const target1 = stock.levels?.target1 || 0;
            const bidStep = target1 >= 1.00 ? 0.01 : 0.005;
            const targetSafe = target1 - (2 * bidStep);

            if (stock.close < ma20) {
                advice = {
                    type: 'sell',
                    text: `Harga tutup (RM ${stock.close.toFixed(3)}) bawah garisan MA20 (RM ${ma20.toFixed(3)}). Trend Momentum mula patah. Cadangan JUAL untuk ambil untung terkumpul.`,
                    color: "text-red-400"
                };
            } else {
                advice = {
                    type: 'hold',
                    text: `HOLD: Harga masih kukuh atas MA20 (RM ${ma20.toFixed(3)}). Teruskan RIDE TREND selagi ombak kuat! Letakkan 'Trailing Stop' pada RM ${ma20.toFixed(3)}. Sasaran terdekat (TP) adalah RM ${targetSafe.toFixed(3)} (2 bid bawah Target 1).`,
                    color: "text-emerald-400"
                };
            }
        }
    }

    const isFav = favouriteTickers.includes(stock.ticker) || (stock.ticker_full && favouriteTickers.includes(stock.ticker_full));



    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-surface border border-white/5 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl animate-in fade-in zoom-in duration-300 overflow-hidden">

                {/* Reject Reason Header */}
                {stock.rejectReason && (
                    <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3 flex items-center gap-3 animate-pulse">
                        <AlertOctagon className="w-5 h-5 text-red-400" />
                        <span className="text-red-400 text-xs font-black uppercase tracking-widest">
                            PERHATIAN: {stock.rejectReason}
                        </span>
                    </div>
                )}

                {/* Header - Sticky */}
                <div className="sticky top-0 z-30 flex items-center justify-between p-6 md:p-8 border-b border-white/5 bg-surfaceHighlight/50 backdrop-blur-xl">
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                {stock.company} <span className="text-gray-400 text-lg">({stock.ticker})</span>
                            </h2>
                            <button
                                onClick={() => onToggleFavourite(stock.ticker_full || stock.ticker)}
                                className={`p-1.5 rounded-lg transition-all ${isFav ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-500/5'}`}
                                title={isFav ? "Remove from Favourites" : "Add to Favourites"}
                            >
                                <Heart className={`w-5 h-5 ${isFav ? 'fill-current' : ''}`} />
                            </button>
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mt-1">
                            {stock.fullName || stock.company}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-3xl font-bold ${pos ? (plPercent >= 0 ? 'text-emerald-400' : 'text-red-400') : (isMomentumMode ? 'text-orange-400' : 'text-primary')}`}>
                                {pos ? `${plPercent >= 0 ? '+' : ''}${plPercent.toFixed(1)}%` : `${isMomentumMode ? 'Momentum Score' : 'Rebound Score'}: ${score.toFixed(1)}`}
                            </span>
                            {!pos && <span className="text-sm text-gray-400"> / 10</span>}
                            {pos && (
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${plAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {plAmount >= 0 ? '+' : ''}RM {(plAmount * (pos.quantity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-xs bg-white/5 px-2 py-1 rounded border border-border text-gray-400">
                                        Entry: RM {pos.entryPrice.toFixed(3)}
                                    </span>
                                </div>
                            )}
                            {stock.historyLabel && (
                                <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 font-bold ml-2">
                                    {stock.historyLabel}
                                </span>
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
                        {/* Column 1: Indicators & Levels (The 'Why') */}
                        <div className="space-y-6">

                            {/* Intraday Decision Support Section */}
                            {pos && (
                                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 rounded-2xl p-5 border border-indigo-500/20 shadow-xl overflow-hidden relative group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                        <Activity className="w-12 h-12 text-indigo-400" />
                                    </div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[11px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4" /> Keputusan Pantas (2j - 4j)
                                            {loadingIntraday && <Loader2 className="w-3 h-3 animate-spin" />}
                                        </h3>
                                        <button
                                            onClick={() => fetchIntraday(stock.ticker, pos)}
                                            disabled={loadingIntraday}
                                            className="p-1.5 rounded-lg bg-white/5 text-indigo-300/60 hover:text-indigo-300 hover:bg-white/10 transition-all active:scale-90 disabled:opacity-50"
                                            title="Refresh Intraday Data"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${loadingIntraday ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>

                                    {loadingIntraday ? (
                                        <div className="space-y-2 py-2">
                                            <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse"></div>
                                            <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse"></div>
                                        </div>
                                    ) : intradayAnalysis ? (
                                        <div className="space-y-4">
                                            {/* MTF Alignment Traffic Lights */}
                                            <div className="flex items-center gap-4 py-2 border-b border-white/5">
                                                <div className="flex flex-col gap-1 items-center">
                                                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">15m</span>
                                                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${intradayAnalysis.alignment.m15 === 'Bullish' ? 'bg-emerald-500 shadow-emerald-500/50' : (intradayAnalysis.alignment.m15 === 'Bearish' ? 'bg-red-500 shadow-red-500/50' : 'bg-gray-500 shadow-gray-500/50')}`}></div>
                                                </div>
                                                <div className="flex flex-col gap-1 items-center">
                                                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">1D</span>
                                                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${intradayAnalysis.alignment.d1 === 'Bullish' ? 'bg-emerald-500 shadow-emerald-500/50' : (intradayAnalysis.alignment.d1 === 'Bearish' ? 'bg-red-500 shadow-red-500/50' : 'bg-gray-500 shadow-gray-500/50')}`}></div>
                                                </div>
                                                <div className="flex flex-col gap-1 items-center">
                                                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">1W</span>
                                                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${intradayAnalysis.alignment.w1 === 'Bullish' ? 'bg-emerald-500 shadow-emerald-500/50' : (intradayAnalysis.alignment.w1 === 'Bearish' ? 'bg-red-500 shadow-red-500/50' : 'bg-gray-500 shadow-gray-500/50')}`}></div>
                                                </div>
                                                <div className="h-6 w-px bg-white/10 ml-2"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-bold text-gray-500 uppercase">Trend Alignment</span>
                                                    <span className={`text-xs font-black ${intradayAnalysis.scoreMTF === 3 ? 'text-emerald-400' : (intradayAnalysis.scoreMTF >= 2 ? 'text-indigo-400' : 'text-gray-400')}`}>
                                                        {intradayAnalysis.scoreMTF} / 3 <span className="text-[10px] opacity-60 italic whitespace-nowrap">Confirmed</span>
                                                    </span>
                                                </div>
                                            </div>

                                            <div className={`p-3 rounded-xl border-l-4 ${intradayAnalysis.adviceType === 'sl' ? 'bg-red-500/10 border-red-500/50' : intradayAnalysis.adviceType === 'tp' ? 'bg-orange-500/10 border-orange-500/50' : 'bg-indigo-500/10 border-indigo-500/50'}`}>
                                                <p className="text-[13px] text-white leading-relaxed font-bold">
                                                    {intradayAnalysis.advice}
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest leading-none mb-1">Harga Semasa</span>
                                                        <span className="text-white font-black text-sm">RM {intradayAnalysis.currentPrice.toFixed(3)}</span>
                                                    </div>
                                                    {pos && (
                                                        <div className="flex flex-col border-l border-white/10 pl-3">
                                                            <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest leading-none mb-1">Untung/Rugi</span>
                                                            <div className="flex items-baseline gap-1.5">
                                                                <span className={`font-black text-sm ${(intradayAnalysis.currentPrice - pos.entryPrice) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                    {(intradayAnalysis.currentPrice - pos.entryPrice) >= 0 ? '+' : ''}RM {((intradayAnalysis.currentPrice - pos.entryPrice) * (pos.quantity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                                <span className={`text-[10px] font-bold opacity-80 ${(intradayAnalysis.currentPrice - pos.entryPrice) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                    ({(intradayAnalysis.currentPrice - pos.entryPrice) >= 0 ? '+' : ''}{(((intradayAnalysis.currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(1)}%)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 opacity-60 group/time">
                                                    <Info className="w-3 h-3 group-hover/time:text-indigo-400 transition-colors" />
                                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                                        {format(new Date(intradayAnalysis.lastUpdated), 'HH:mm')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500 italic py-2">
                                            Data analisa sedang dijana. Sila tumpu sekejap...
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Advice Section for Owned Stocks */}
                            {pos && advice && (
                                <div className={`p-4 rounded-xl border animate-in zoom-in duration-300 ${advice.type === 'sell' ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                    <div className="flex items-start gap-3">
                                        {advice.type === 'sell' ? <AlertOctagon className="w-5 h-5 text-red-400 mt-0.5 shrink-0" /> : <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />}
                                        <div>
                                            <div className={`text-sm font-black uppercase tracking-wider mb-1 ${advice.color}`}>
                                                NASIHAT: {advice.type === 'sell' ? 'JUAL / AMBIL UNTUNG' : 'HOLD / KEKAL PEGANG'}
                                            </div>
                                            <div className="text-xs text-gray-300 leading-relaxed font-medium">
                                                {advice.text}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Position Management Form */}
                            <PositionManager
                                ticker={stock.ticker}
                                currentPrice={stock.close}
                                existingPosition={pos}
                                technicalLevels={stock.levels}
                                recommendedStrategy={strategy}
                                onSave={(data) => onSavePosition(stock.ticker, data)}
                                onRemove={onRemovePosition}
                                onSell={(data) => pos && onSellPosition({ ...data, ticker_full: stock.ticker, entry_price: pos.entryPrice, strategy: pos.strategy, buy_date: pos.buyDate })}
                            />

                            {/* Key Metrics */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-background p-3 rounded-lg border border-border text-center">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Close</div>
                                    <div className="text-base font-mono font-semibold text-white">
                                        RM {stock.close.toFixed(3)}
                                    </div>
                                </div>
                                <div className="bg-background p-3 rounded-lg border border-border text-center">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">RSI (14)</div>
                                    <div className={`text-base font-mono font-semibold ${stock.stats.rsi14 >= 70 ? 'text-red-400' :
                                        stock.stats.rsi14 <= 30 ? 'text-green-400' : 'text-blue-400'
                                        }`}>
                                        {stock.stats.rsi14?.toFixed(1) || '-'}
                                    </div>
                                </div>
                                <div className="bg-background p-3 rounded-lg border border-border text-center">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Drawdown</div>
                                    <div className="text-base font-mono font-semibold text-red-400">
                                        -{stock.stats.dropdownPercent}%
                                    </div>
                                </div>
                            </div>

                            {/* Signals */}
                            <div>
                                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> Detected Signals
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {stock.signals && stock.signals.length > 0 ? (
                                        stock.signals.map(signal => (
                                            <span key={signal} className={`
                                            px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm
                                            ${signal === 'UPTREND' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                                            ${signal === 'PULLBACK' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : ''}
                                            ${signal === 'REBOUND' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                                            ${!['UPTREND', 'PULLBACK', 'REBOUND'].includes(signal) ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' : ''}
                                        `}>
                                                {signal}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-gray-500 text-sm italic">No strong signals</span>
                                    )}
                                </div>
                            </div>

                            {/* Support & Resistance Levels */}
                            {stock.levels && (
                                <div className="bg-surfaceHighlight/50 rounded-lg p-4 border border-border">
                                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <BarChart2 className="w-4 h-4 text-accent" /> Key Levels
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-2.5 bg-background rounded-lg border border-border">
                                            <div className="text-[9px] text-gray-500 uppercase font-black mb-0.5">Resistance</div>
                                            <div className="text-base font-mono text-red-400 font-bold">{stock.levels.resistance?.toFixed(3) || "N/A"}</div>
                                            <div className="text-[9px] text-gray-600 font-medium uppercase tracking-tighter">{stock.levels.resistanceStrength} Strength</div>
                                        </div>
                                        <div className="p-2.5 bg-background rounded-lg border border-border">
                                            <div className="text-[9px] text-gray-500 uppercase font-black mb-0.5">Support</div>
                                            <div className="text-base font-mono text-green-400 font-bold">{stock.levels.support?.toFixed(3) || "N/A"}</div>
                                            <div className="text-[9px] text-gray-600 font-medium uppercase tracking-tighter">{stock.levels.supportStrength} Strength</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Moving Averages Table */}
                            <div className="bg-background rounded-lg border border-border overflow-hidden">
                                <div className="p-2.5 bg-surfaceHighlight/30 border-b border-border text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <BarChart2 className="w-3 h-3" /> Moving Averages
                                </div>
                                <table className="w-full text-xs text-left">
                                    <tbody className="divide-y divide-border">
                                        <tr className="group hover:bg-white/5">
                                            <td className="p-2.5 text-gray-500 font-medium">MA 20 (Short Trend)</td>
                                            <td className="p-2.5 text-right font-mono text-gray-300 font-bold">{stock.stats.ma20?.toFixed(3) || '-'}</td>
                                        </tr>
                                        <tr className="group hover:bg-white/5">
                                            <td className="p-2.5 text-gray-500 font-medium">MA Med (50)</td>
                                            <td className="p-2.5 text-right font-mono text-gray-300 font-bold">{stock.stats.ma50?.toFixed(3) || '-'}</td>
                                        </tr>
                                        <tr className="group hover:bg-white/5">
                                            <td className="p-2.5 text-gray-500 font-medium">MA Long (200)</td>
                                            <td className="p-2.5 text-right font-mono text-gray-300 font-bold">{stock.stats.ma200?.toFixed(3) || '-'}</td>
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

                        {/* Column 2: Verdict & Strategy (The 'Action') */}
                        <div className="space-y-6">

                            {/* Recommendation Card */}
                            {(() => {
                                const isMomentumFocus = isMomentumMode;
                                const scoreToUse = score;

                                let rec = "NEUTRAL";
                                let conviction = Math.round(scoreToUse * 10);
                                let bg = "bg-gray-500/10 border-gray-500/20";
                                let text = "text-gray-400";
                                let description = "Isyarat belum cukup kuat untuk keputusan beli. Perhatikan paras harga penting.";

                                // Decision Verdict Logic (Traffic Light)
                                let verdict = "NEUTRAL";
                                let vColor = "bg-gray-500/10 text-gray-400 border-gray-500/20";
                                let vIcon = <Activity className="w-5 h-5" />;
                                const rrNum = stock.levels?.rr1 || 0;

                                if (pos) {
                                    // Hybrid Logic: System Technicals + Personal Trade Plan
                                    const personalTP = parseFloat(pos.targetPrice);
                                    const personalSL = parseFloat(pos.stopLoss);
                                    const currentPrice = stock.close;

                                    // 1. Critical Exit: Stop Loss hit
                                    if (personalSL && currentPrice <= personalSL) {
                                        verdict = "STRONG SELL / CUT";
                                        vColor = "bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/40 font-black";
                                        vIcon = <AlertOctagon className="w-5 h-5" />;
                                    }
                                    // 2. Critical Exit: Take Profit hit
                                    else if (personalTP && currentPrice >= personalTP) {
                                        verdict = "SELL ALL / TP";
                                        vColor = "bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/40 font-black";
                                        vIcon = <CheckCircle className="w-5 h-5" />;
                                    }
                                    // 3. Proximity Advice: Near TP (within 2%)
                                    else if (personalTP && currentPrice >= (personalTP * 0.98)) {
                                        verdict = "MONITOR / TP";
                                        vColor = "bg-orange-500 text-black border-orange-500 shadow-lg shadow-orange-500/30 font-black";
                                        vIcon = <Activity className="w-5 h-5" />;
                                    }
                                    // 4. System Technical Breakdown
                                    else if (stock.rejectReason || scoreToUse < 5.0) {
                                        verdict = "STRONG SELL / CUT";
                                        vColor = "bg-red-500/20 text-red-500 border-red-500/50";
                                        vIcon = <AlertOctagon className="w-5 h-5" />;
                                    }
                                    // 5. System Technical Strength
                                    else if (scoreToUse >= 7.0) {
                                        if (rrNum >= 2.0) {
                                            const ha1d = stock.heikinAshiGo;
                                            const ha4h = intradayAnalysis?.ha4h?.status === 'GO';

                                            if (ha1d && ha4h) {
                                                verdict = "DOUBLE GO";
                                                vColor = "bg-emerald-500 text-black border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)]";
                                                vIcon = <Zap className="w-5 h-5 fill-black" />;
                                            } else if (ha1d) {
                                                verdict = "GO";
                                                vColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-500/5";
                                                vIcon = <CheckCircle className="w-5 h-5" />;
                                            } else {
                                                verdict = "WAIT / QUE";
                                                vColor = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
                                                vIcon = <Loader2 className="w-5 h-5" />;
                                            }
                                        } else {
                                            verdict = "HOLD / SELL HALF";
                                            vColor = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-lg shadow-yellow-500/5";
                                            vIcon = <Activity className="w-5 h-5" />;
                                        }
                                    }
                                    // 6. Neutral (Default)
                                    else {
                                        verdict = "MONITOR";
                                        vColor = "bg-gray-500/10 text-gray-400 border-gray-500/20";
                                        vIcon = <Activity className="w-5 h-5" />;
                                    }
                                } else {
                                    // Entry-focused advice for watchlist/discovery
                                    if (stock.rejectReason || scoreToUse < 5.0) {
                                        verdict = "AVOID";
                                        vColor = "bg-red-500/20 text-red-500 border-red-500/50";
                                        vIcon = <AlertOctagon className="w-5 h-5" />;
                                    } else if (scoreToUse >= 7.0) {
                                        if (rrNum >= 2.0) {
                                            const ha1d = stock.heikinAshiGo;
                                            const ha4h = intradayAnalysis?.ha4h?.status === 'GO';

                                            if (ha1d && ha4h) {
                                                verdict = "DOUBLE GO";
                                                vColor = "bg-emerald-500 text-black border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)]";
                                                vIcon = <Zap className="w-5 h-5 fill-black" />;
                                            } else if (ha1d) {
                                                verdict = "GO";
                                                vColor = "bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/20";
                                                vIcon = <CheckCircle className="w-5 h-5" />;
                                            } else {
                                                verdict = "WAIT / QUE";
                                                vColor = "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
                                                vIcon = <Loader2 className="w-5 h-5" />;
                                            }
                                        } else {
                                            verdict = "HOLD / SELL HALF";
                                            vColor = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-lg shadow-yellow-500/5";
                                            vIcon = <Activity className="w-5 h-5" />;
                                        }
                                    }
                                }

                                if (stock.stats.rsi14 >= 75) {
                                    rec = isMomentumFocus ? "OVEREXTENDED (MOMENTUM)" : "TAKE PROFIT / SELL";
                                    bg = "bg-red-500/10 border-red-500/50";
                                    text = "text-red-400";
                                    conviction = 85;
                                    description = isMomentumFocus
                                        ? "Saham ini dalam momentum kuat tetapi sudah terlalu panas (Overstretched). Risiko 'pullback' mendadak adalah tinggi."
                                        : "Harga sudah terlalu tinggi (RSI > 75). Pertimbangkan untuk ambil untung (lock profit).";
                                } else if (scoreToUse >= 8.5) {
                                    rec = isMomentumFocus ? "MOMENTUM RIDE" : "STRONG BUY";
                                    bg = isMomentumFocus
                                        ? "bg-orange-500/20 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
                                        : "bg-accent/20 border-accent/50 shadow-[0_0_20px_rgba(251,191,36,0.15)]";
                                    text = isMomentumFocus ? "text-orange-400" : "text-accent";
                                    conviction = Math.min(99, conviction + 5);
                                    description = isMomentumFocus
                                        ? "Momentum sangat kuat dengan pengesahan volume. Sesuai untuk strategi 'Breakout' atau 'Trend Following'."
                                        : "Setup terbaik dengan pengesahan trend yang kuat. Potensi 'rebound' yang tinggi.";
                                } else if (scoreToUse >= 7.0) {
                                    rec = isMomentumFocus ? "MOMENTUM BUY" : "BUY";
                                    bg = "bg-primary/20 border-primary/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]";
                                    text = "text-primary";
                                    description = isMomentumFocus
                                        ? "Saham menunjukkan kekuatan momentum yang sihat. Peluang untuk 'Swing' jangka pendek."
                                        : "Sedang melakukan 'healthy pullback'. Nisbah risiko-ke-untung (RR) yang menarik untuk masuk.";
                                } else if (scoreToUse >= 5.0) {
                                    rec = isMomentumFocus ? "MOMENTUM WATCH" : "WATCHLIST / MONITOR";
                                    bg = "bg-blue-500/10 border-blue-500/30";
                                    text = "text-blue-300";
                                    description = isMomentumFocus
                                        ? "Ada tanda-tanda awal momentum bermula. Tunggu pengesahan volume untuk masuk."
                                        : "Trend menaik masih ada, tetapi tunggu isyarat harga yang lebih jelas untuk masuk.";
                                }

                                // Gauge Value Calculation
                                let verdictValue = 50; // Neutral
                                if (verdict === "GO" || verdict === "DOUBLE GO" || verdict === "HOLD") verdictValue = 90;
                                else if (verdict === "WAIT / QUE" || verdict === "HOLD / SELL HALF") verdictValue = 70;
                                else if (verdict === "AVOID" || verdict === "STRONG SELL / CUT") verdictValue = 10;
                                else if (verdict === "NEUTRAL" || verdict === "MONITOR") verdictValue = 50;
                                else if (verdict === "MONITOR / TP") verdictValue = 40;

                                return (
                                    <>
                                        {/* Technical Gauges Section - Recovered Single Gauge Layout */}
                                        <div className="bg-surfaceHighlight/30 rounded-2xl p-6 border border-white/5 flex flex-col items-center mb-6">
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Technical Decision</h4>
                                            <div className="w-full flex justify-center mb-4">
                                                <GaugeMeter
                                                    value={verdictValue}
                                                    label={verdict}
                                                    isPortfolio={!!pos}
                                                    color={vColor.includes('emerald') ? '#10b981' : (vColor.includes('red') ? '#ef4444' : (vColor.includes('yellow') ? '#fbbf24' : '#94a3b8'))}
                                                />
                                            </div>
                                            <div className="w-full flex flex-col items-center gap-3 pt-4 border-t border-white/5">
                                                <div className="grid grid-cols-2 gap-4 w-full">
                                                    <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-xl border border-white/5">
                                                        <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5">1D HA Conf</h4>
                                                        <div className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${stock.heikinAshiGo ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                            {stock.heikinAshiGo ? <CheckCircle className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                            {stock.heikinAshiGo ? stock.haReason : "WAIT"}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-xl border border-white/5">
                                                        <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5">4H HA Conf</h4>
                                                        <div className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${loadingIntraday ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' : (intradayAnalysis?.ha4h?.status === 'GO' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/20')}`}>
                                                            {loadingIntraday ? <Loader2 className="w-3 h-3 animate-spin text-gray-400" /> : (intradayAnalysis?.ha4h?.status === 'GO' ? <Zap className="w-3 h-3 fill-emerald-400" /> : <TrendingDown className="w-3 h-3" />)}
                                                            {loadingIntraday ? "LOADING..." : (intradayAnalysis?.ha4h?.reason || "WAIT")}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center border-t border-white/5 pt-3 w-full">
                                                    <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">System Conviction</h4>
                                                    <div className="text-xl font-black text-blue-400 mb-3">{conviction}%</div>

                                                    {/* Double GO Checklist */}
                                                    <div className="w-full bg-black/20 rounded-lg p-3 border border-white/5">
                                                        <h5 className="text-[8px] text-gray-400 font-bold uppercase tracking-wider mb-2 text-center flex items-center justify-center gap-2">
                                                            Double GO Checklist
                                                            {(verdict === "DOUBLE GO") && <span className="text-emerald-400 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded text-[7px] flex items-center gap-1"><Zap className="w-2.5 h-2.5 fill-emerald-400" /> PASSED</span>}
                                                        </h5>
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="flex items-center justify-between text-[9px] font-bold">
                                                                <span className="text-gray-400">Score ≥ 7.0</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={scoreToUse >= 7.0 ? "text-emerald-400" : "text-gray-300"}>{scoreToUse.toFixed(1)}</span>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${scoreToUse >= 7.0 ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]'}`}></div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between text-[9px] font-bold">
                                                                <span className="text-gray-400">RR Ratio ≥ 2.0</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={rrNum >= 2.0 ? "text-emerald-400" : "text-gray-300"}>{rrNum.toFixed(2)}</span>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${rrNum >= 2.0 ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]'}`}></div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between text-[9px] font-bold">
                                                                <span className="text-gray-400">1D HA Conf</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={stock.heikinAshiGo ? "text-emerald-400" : "text-red-400"}>{stock.heikinAshiGo ? "Hijau" : "Wait"}</span>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${stock.heikinAshiGo ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]'}`}></div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between text-[9px] font-bold">
                                                                <span className="text-gray-400">4H HA Conf</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={intradayAnalysis?.ha4h?.status === 'GO' ? "text-emerald-400" : (loadingIntraday ? "text-gray-500" : "text-red-400")}>
                                                                        {loadingIntraday ? "Loading" : (intradayAnalysis?.ha4h?.status === 'GO' ? "Hijau" : "Wait")}
                                                                    </span>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${loadingIntraday ? 'bg-gray-500 animate-pulse' : (intradayAnalysis?.ha4h?.status === 'GO' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]')}`}></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`rounded-[2rem] p-6 md:p-8 border relative overflow-hidden transition-all duration-500 ${bg}`}>
                                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4 relative z-10">
                                                <div className="flex flex-col">
                                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                                                        {isMomentumFocus ? "Momentum System" : "Rebound System"}
                                                    </h3>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className={`text-xl font-black ${text}`}>{rec}</span>
                                                        <span className="text-[10px] font-mono text-gray-500 opacity-60">{conviction}% Confidence</span>
                                                    </div>
                                                </div>

                                                {/* Decision Verdict Badge */}
                                                <div className="flex items-center gap-2">
                                                    {/* Telegram Alert Toggle */}
                                                    {favouriteTickers.includes(stock.ticker) && (
                                                        <button
                                                            onClick={() => onToggleAlert(stock.ticker, !favouriteDetails[stock.ticker]?.alert_enabled)}
                                                            className={`p-2 rounded-xl border-2 transition-all duration-300 ${favouriteDetails[stock.ticker]?.alert_enabled
                                                                ? 'bg-primary/20 text-primary border-primary shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse'
                                                                : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'}`}
                                                            title={favouriteDetails[stock.ticker]?.alert_enabled ? "Alert Telegram Aktif" : "Aktifkan Alert Telegram"}
                                                        >
                                                            {favouriteDetails[stock.ticker]?.alert_enabled ? <Bell className="w-5 h-5 fill-current" /> : <BellOff className="w-5 h-5" />}
                                                        </button>
                                                    )}

                                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-black text-sm shadow-xl transition-all duration-500 ${vColor}`}>
                                                        {vIcon}
                                                        {verdict}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                                {isMomentumFocus ? <TrendingUp className="w-16 h-16 -mr-4 -mt-4 rotate-12" /> : <BarChart2 className="w-16 h-16 -mr-4 -mt-4 rotate-12" />}
                                            </div>
                                            <p className="text-[13px] text-gray-300 leading-relaxed font-medium">
                                                {description}
                                            </p>

                                            {(() => {
                                                const rDays = intradayAnalysis?.alignment?.rallyDays;
                                                const pDays = intradayAnalysis?.alignment?.pullbackDays;
                                                const currentRR = stock.levels?.rr1 || 0;
                                                let subAdvice = null;
                                                let subColor = "text-blue-400";

                                                if (rDays > 0) {
                                                    if (rDays <= 2) {
                                                        if (currentRR < 1.5) {
                                                            subAdvice = `Rally baru bermula (${rDays}H) TAPI RR rendah (${currentRR.toFixed(2)}). Berisiko untuk 'chasing', lebih baik tunggu pullback untuk RR yang lebih cantik.`;
                                                            subColor = "text-orange-400";
                                                        } else {
                                                            subAdvice = `Fasa Breakout Awal (${rDays}H). RR sangat menarik (${currentRR.toFixed(2)}). Peluang masuk yang berkualiti jika volume kuat.`;
                                                            subColor = "text-emerald-400";
                                                        }
                                                    } else if (rDays === 3) {
                                                        if (currentRR < 1.2) {
                                                            subAdvice = `Trend sudah kuat (3H), tapi harga sudah mula menjauhi Stop-Loss (RR: ${currentRR.toFixed(2)}). Risiko mula meningkat.`;
                                                            subColor = "text-orange-400";
                                                        } else {
                                                            subAdvice = `Sweet Spot! Trend 3 hari sudah sah. Waktu terbaik untuk Swing dengan RR ${currentRR.toFixed(2)}.`;
                                                            subColor = "text-emerald-400";
                                                        }
                                                    } else {
                                                        subAdvice = `Overextended! Rally sudah ${rDays} hari. Elak FOMO kerana risiko jualan tiba-tiba adalah tinggi.`;
                                                        subColor = "text-orange-400";
                                                    }
                                                } else if (pDays > 0) {
                                                    if (pDays <= 2) {
                                                        subAdvice = `Pullback Sihat (${pDays}H). Perhatikan jika harga bertahan di atas Support. RR semasa: ${currentRR.toFixed(2)}.`;
                                                        subColor = "text-orange-400";
                                                    } else {
                                                        subAdvice = `Trend Jualan Kuat (${pDays}H). Elak 'tangkap pisau jatuh'. Tunggu isyarat rebound sebelum masuk.`;
                                                        subColor = "text-red-400";
                                                    }
                                                }

                                                if (!subAdvice) return null;

                                                return (
                                                    <div className="mt-3 pt-3 border-t border-white/10 flex gap-2 items-start">
                                                        <Info className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${subColor}`} />
                                                        <p className={`text-[11px] font-bold leading-tight ${subColor}`}>
                                                            {subAdvice}
                                                        </p>
                                                    </div>
                                                );
                                            })()}

                                            <div className="mt-4 flex gap-2">
                                                {stock.stats.rsi14 < 35 && <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/20 font-bold uppercase">Oversold</span>}
                                                {stock.signals?.includes('REBOUND') && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold uppercase">Rebound</span>}
                                                {stock.signals?.includes('MOMENTUM') && <span className="text-[9px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20 font-bold uppercase">Momentum</span>}
                                                {stock.isMinervini && <span className="text-[9px] bg-accent/20 text-accent px-2 py-0.5 rounded border border-accent/20 font-bold uppercase">Minervini Setup</span>}
                                                {stock.isMASupport && <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 font-bold uppercase">MA Support</span>}
                                                {stock.stats.ma20 > stock.close && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20 font-bold uppercase">Bawah MA20</span>}
                                                {intradayAnalysis?.alignment?.pullbackDays > 0 && (
                                                    <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${intradayAnalysis.alignment.pullbackDays >= 3 ? 'bg-red-500/20 text-red-400 border-red-500/20' : 'bg-orange-500/20 text-orange-400 border-orange-500/20'}`}>
                                                        Pullback: {intradayAnalysis.alignment.pullbackDays} Hari
                                                    </span>
                                                )}
                                                {intradayAnalysis?.alignment?.rallyDays > 0 && (
                                                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase">
                                                        Rally: {intradayAnalysis.alignment.rallyDays} Hari
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}


                            {/* Setup Analysis (Malay Descriptions) */}
                            <div className="bg-surfaceHighlight/30 rounded-xl p-5 border border-border">
                                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-primary" /> Analisa Teknikal Lanjut
                                </h3>
                                <div className="space-y-4 text-xs">
                                    {stock.isMinervini && (
                                        <div className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div>
                                            <div>
                                                <div className="font-bold text-accent uppercase mb-0.5">Minervini Trend Template</div>
                                                <div className="text-gray-400 leading-relaxed">Saham memenuhi kriteria Mark Minervini: Trend menaik yang matang, harga atas MA200, dan berada di fasa pengumpulan (*Stage 2 accumulation*). Sesuai untuk *Momentum Breakout*.</div>
                                            </div>
                                        </div>
                                    )}
                                    {stock.isMASupport && (
                                        <div className="flex gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                                            <div>
                                                <div className="font-bold text-cyan-400 uppercase mb-0.5">Mean Reversion (MA Support)</div>
                                                <div className="text-gray-400 leading-relaxed">Harga sedang melantun atau bertahan di atas garisan purata (MA50/MA200). Ini menunjukkan sokongan dinamik yang kuat sebelum menyambung kenaikan.</div>
                                            </div>
                                        </div>
                                    )}
                                    {!stock.isMinervini && !stock.isMASupport && (
                                        <div className="text-gray-500 italic">Tiada setup teknikal lanjut ditemui buat masa ini.</div>
                                    )}
                                </div>
                            </div>

                            {/* Trade Setup Strategy */}
                            {stock.planText && (
                                <div className="bg-primary/5 rounded-lg p-5 border border-primary/20">
                                    <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> Pelan Dagangan Swing
                                    </h3>
                                    {/* ... existing trade plan UI ... */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-black block mb-1">Entry Trigger</label>
                                            <div className="text-sm text-white font-bold">{stock.planText.entryTrigger}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase font-black block mb-1">Target 1 (TP)</label>
                                                <div className="text-sm text-green-400 font-black">RM {stock.levels.target1}</div>
                                                <div className="text-[10px] text-gray-500">+{((stock.levels.target1 - stock.close) / stock.close * 100).toFixed(1)}% Potensi</div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase font-black block mb-1">Target 2 (Puncak)</label>
                                                <div className="text-sm text-blue-400 font-black">RM {stock.levels.target2}</div>
                                                <div className="text-[10px] text-gray-500">+{((stock.levels.target2 - stock.close) / stock.close * 100).toFixed(1)}% Potensi</div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end pt-3 border-t border-white/5">
                                            <div>
                                                <label className="text-[10px] text-red-400/80 uppercase font-black block mb-1">Stop Loss (Exit)</label>
                                                <div className="text-sm text-red-400 font-black">RM {stock.levels.stopPrice}</div>
                                                <div className="text-[10px] text-gray-500">Risk: {((stock.close - stock.levels.stopPrice) / stock.close * 100).toFixed(1)}%</div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${stock.levels.rr1 >= 2.0 ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                                                    RR Ratio: {stock.levels.rr1}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                                {sec.text.split('**').map((part, i) => i % 2 === 1 ? <b key={i} className="text-white">{part}</b> : part)}
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
                        </div >
                    </div>
                </div>

                {/* Footer - Sticky Bottom */}
                <div className="sticky bottom-0 z-30 p-6 md:p-8 border-t border-white/5 bg-surfaceHighlight/50 backdrop-blur-xl flex justify-between items-center">
                    <a
                        href={`https://www.tradingview.com/chart/?symbol=${stock.ticker.split('.')[0]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs md:text-sm text-gray-500 hover:text-white transition-colors group px-4 py-2 bg-white/5 rounded-xl border border-white/5"
                    >
                        <ExternalLink className="w-4 h-4 group-hover:text-primary transition-colors" />
                        Open in TradingView
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
}
