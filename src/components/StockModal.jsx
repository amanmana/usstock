import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, BarChart2, ExternalLink, Heart, CheckCircle, Loader2, Info, AlertOctagon, Activity, RefreshCw, Bell, BellOff, Zap, Target, Clock, Copy, Check } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
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

const formatValue = (val, decimals = 3) => {
    if (val === null || val === undefined) return "—";
    const num = parseFloat(val);
    if (isNaN(num)) return "—";
    return num.toFixed(decimals);
};

const normalizeTradingViewSymbol = (ticker = '', market = '', stock = {}) => {
    const symbolOnly = (ticker || '').split('.')[0].toUpperCase();

    // 1. Force Bursa if ticker contains .KL or market/stock indicates MYR
    if (ticker.toUpperCase().endsWith('.KL') || market?.toUpperCase() === 'KLSE' || stock?.market === 'MYR') {
        return `MYX:${symbolOnly}`;
    }

    const exchangeMap = {
        'MYX': 'MYX',
        'MYR': 'MYX',
        'KLSE': 'MYX',
        'NASDAQ': 'NASDAQ',
        'NYSE': 'NYSE',
        'AMEX': 'AMEX'
    };

    let internalEx = stock?.exchange || market;
    const tvExchange = exchangeMap[internalEx?.toUpperCase()];

    if (tvExchange) {
        return `${tvExchange}:${symbolOnly}`;
    }

    return symbolOnly;
};

const TradingViewWidget = ({ ticker, market, stock }) => {
    const containerRef = React.useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const tvSymbol = normalizeTradingViewSymbol(ticker, market, stock);
    const isBursa = tvSymbol.startsWith('MYX:');

    // Stabilize containerId so it doesn't change on every render
    const containerId = React.useMemo(() =>
        `tv-chart-${ticker.replace(/\./g, '-')}-${Math.floor(Math.random() * 10000)}`,
        [ticker]
    );

    useEffect(() => {
        if (isBursa) {
            setLoading(false);
            return;
        }

        let isMounted = true;
        const createWidget = () => {
            if (!isMounted) return;
            if (window.TradingView && containerRef.current) {
                containerRef.current.innerHTML = '';
                const widgetDiv = document.createElement('div');
                widgetDiv.id = containerId;
                widgetDiv.style.width = '100%';
                widgetDiv.style.height = '100%';
                containerRef.current.appendChild(widgetDiv);

                try {
                    new window.TradingView.widget({
                        "autosize": true,
                        "symbol": tvSymbol,
                        "interval": "D",
                        "timezone": "Etc/UTC",
                        "theme": "dark",
                        "style": "1",
                        "locale": "ms_MY",
                        "toolbar_bg": "#0a0a0c",
                        "enable_publishing": false,
                        "hide_side_toolbar": false,
                        "allow_symbol_change": true,
                        "container_id": containerId,
                        "width": "100%",
                        "height": "100%"
                    });
                    setLoading(false);
                } catch (e) {
                    console.error("TradingView widget init failed:", e);
                    setError(true);
                }
            }
        };

        if (!window.TradingView) {
            // Check if script already exists to avoid multiple appends
            if (!document.getElementById('tradingview-widget-script')) {
                const script = document.createElement('script');
                script.id = 'tradingview-widget-script';
                script.src = 'https://s3.tradingview.com/tv.js';
                script.async = true;
                script.onload = () => { if (isMounted) createWidget(); };
                script.onerror = () => { if (isMounted) setError(true); };
                document.head.appendChild(script);
            } else {
                // If script is already there but window.TradingView is not yet ready, 
                // we might need to wait or use a poller, but usually onload handles it for the first one.
                // For subsequent ones, we just wait a bit.
                const checkInterval = setInterval(() => {
                    if (window.TradingView) {
                        clearInterval(checkInterval);
                        if (isMounted) createWidget();
                    }
                }, 100);
                return () => {
                    clearInterval(checkInterval);
                    isMounted = false;
                };
            }
        } else {
            const timer = setTimeout(() => { if (isMounted) createWidget(); }, 250);
            return () => {
                clearTimeout(timer);
                isMounted = false;
            };
        }
        return () => { isMounted = false; };
    }, [tvSymbol, containerId, isBursa]);

    if (isBursa) {
        return (
            <div className="w-full h-full flex flex-col">
                <div className="bg-orange-500/5 border-b border-orange-500/10 px-4 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Info className="w-3 h-3 text-orange-400" />
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Bursa Interactive (Limited View)</span>
                    </div>
                    <span className="text-[8px] text-gray-500 font-bold italic">Sila guna 'New Tab' untuk analisa luas</span>
                </div>
                <div className="flex-1 bg-black">
                    <iframe
                        key={tvSymbol}
                        src={`https://www.tradingview.com/widgetembed/?symbol=${tvSymbol}&interval=D&theme=dark&locale=ms_MY&hidesidetoolbar=0&symboledit=0&saveimage=0&toolbarbg=0a0a0c`}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="Bursa Malaysia Chart"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            {loading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surfaceHighlight/10 gap-3 z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Loading Interactive Chart...</span>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/5 text-center p-8 z-10">
                    <AlertOctagon className="w-8 h-8 text-red-500 mb-4" />
                    <span className="text-red-400 font-black uppercase text-xs mb-2">Gagal Memaparkan Carta</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Sila gunakan pautan "New Tab" di bawah.</span>
                </div>
            )}
            <div id={containerId} ref={containerRef} className="w-full h-full" />
        </div>
    );
};

export function StockModal({
    isOpen,
    onClose,
    stock,
    onTradeRefresh,
    strategy = 'momentum',
    market = 'US',
    favouriteTickers = [],
    favouriteDetails = {},
    onToggleFavourite,
    onToggleAlert,
    positions = {},
    onSavePosition,
    onRemovePosition,
    onSellPosition,
    onStockUpdate
}) {
    const currency = (market === 'MYR' || market === 'KLSE' || stock?.market === 'MYR' || stock?.market === 'KLSE') ? 'RM' : 'USD';
    const currencySymbol = currency === 'RM' ? 'RM ' : '$';
    const isBursa = currency === 'RM' || stock?.ticker?.endsWith('.KL');

    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [tradePlan, setTradePlan] = useState(null);
    const [loadingTradePlan, setLoadingTradePlan] = useState(false);
    const [isShariahUpdating, setIsShariahUpdating] = useState(false);
    const [showChart, setShowChart] = useState(false);
    const [copiedPlan, setCopiedPlan] = useState(false);

    const fetchTradePlan = (ticker) => {
        if (!ticker) {
            console.warn("fetchTradePlan aborted: missing ticker");
            return;
        }
        console.log(`Fetching comprehensive trade plan for ${ticker}...`);
        setLoadingTradePlan(true);
        const timestamp = new Date().getTime();
        fetch(`/.netlify/functions/analyzeStockOnDemand?ticker=${ticker}&cb=${timestamp}`)
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
                            score: plan.raw?.liveStock?.score ?? plan.snapshotScore10 ?? stock.score,
                            momentumScore: plan.raw?.liveStock?.momentumScore ?? plan.snapshotScore10 ?? stock.momentumScore,
                            liveScore: strategy === 'momentum'
                                ? (plan.momentumScore10 || plan.snapshotScore10)
                                : strategy === 'hybrid'
                                    ? Math.max(plan.snapshotScore10 || 0, plan.momentumScore10 || 0)
                                    : plan.snapshotScore10,
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


    useEffect(() => {
        if (isBursa) {
            setShowChart(false);
        }
    }, [isBursa]);

    if (!stock) return null;

    // Simplified Data Derivation
    const plan = tradePlan || {
        ticker: stock.ticker,
        company_name: stock.company,
        price: stock.close,
        open: stock.open,
        prevClose: stock.prevClose || stock.previousClose,
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
                text: `SASARAN TP1 TERCAPAI (+${Number(plPercent).toFixed(1)}%). Cadangan: JUAL 50% untuk kunci untung dan biarkan baki 'run' dengan Trailing Stop.`,
                color: "text-emerald-400 font-bold"
            };
        }
        // 3. Lindung Modal & Trend
        else if (plan.price < ma10 && ma10 > 0) {
            advice = {
                type: 'sell',
                text: `Trend Pendek Melemah: Harga tutup bawah MA10 (${currency} ${ma10.toFixed(3)}). Cadangan: KELUAR sepenuhnya atau sebahagian untuk selamatkan untung.`,
                color: "text-yellow-500"
            };
        } else if (plPercent >= 5) {
            advice = {
                type: 'hold',
                text: `MODAL DILINDUNGI: Untung sudah >5%. Gerakkan Stop Loss ke Harga Belian (${currency} ${pos.entryPrice.toFixed(3)}) untuk 'Risk Free Trade'.`,
                color: "text-indigo-400"
            };
        } else if (plan.price <= stopLoss) {
            advice = {
                type: 'sell',
                text: `STOP LOSS HIT: Harga (${currency} ${plan.price.toFixed(3)}) bocor paras sokongan (${currency} ${stopLoss.toFixed(3)}). KELUAR SEGERA.`,
                color: "text-red-400"
            };
        }
        // Default Hold
        else {
            const lowIntraday = plan.multiTimeframe.confirmedCount === 0;
            const strategyText = plan.trade.strategyLabel === 'Momentum' ? `Kekal atas MA20 (${currency} ${ma20.toFixed(3)})` : `Masih dalam zon sihat`;
            advice = {
                type: 'hold',
                text: lowIntraday
                    ? `HOLD (AMARAN): Sentiment intraday lemah (0/3). Masih ${strategyText}. Pantau rapi paras ${currency} ${stopLoss.toFixed(3)}.`
                    : `HOLD: ${strategyText}. Sasaran TP1 seterusnya adalah ${currency} ${target1.toFixed(3)}. Teruskan 'ride' selagi trend belum patah.`,
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
                                {pos ? `${plPercent >= 0 ? '+' : ''}${Number(plPercent).toFixed(1)}%` : `SNAPSHOT: ${Number(
                                    strategy === 'momentum'
                                        ? (plan.momentumScore10 || plan.snapshotScore10)
                                        : strategy === 'hybrid'
                                            ? Math.max(plan.snapshotScore10 || 0, plan.momentumScore10 || 0)
                                            : plan.snapshotScore10
                                ).toFixed(1)}`}
                            </span>
                            {!pos && <span className="text-sm text-gray-500 font-bold uppercase tracking-widest ml-1"> / 10</span>}
                            {pos && (
                                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-white/10">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">PL ({currency})</span>
                                        <span className={`text-sm font-black ${plAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {plAmount >= 0 ? '+' : ''}{currencySymbol}{(plAmount * (pos.quantity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">{isBursa ? 'Jumlah Lot' : 'Quantity'}</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xs text-white font-bold">
                                                {isBursa ? (pos.quantity / 100).toLocaleString() : pos.quantity.toLocaleString()}
                                            </span>
                                            {isBursa && <span className="text-[10px] text-gray-500 font-bold uppercase">Lots</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Entry</span>
                                        <span className="text-xs text-white font-bold">{currency} {pos.entryPrice.toFixed(3)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Modal ({currency})</span>
                                        <span className="text-xs text-white/90 font-bold">
                                            {currencySymbol}{(pos.quantity * pos.entryPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    {pos.buyDate && (
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Holding</span>
                                            <span className="text-xs text-blue-400 font-bold">
                                                {differenceInDays(new Date(), new Date(pos.buyDate))} Days
                                            </span>
                                        </div>
                                    )}
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

                                        {(() => {
                                            const alignment = plan.alignment || 0;
                                            const sentiment = plan.sentiment4h || 'NEUTRAL';

                                            // Override text if owned
                                            if (pos) {
                                                const currentPrice = plan.price || stock.close;
                                                const sl = parseFloat(pos.stopLoss);
                                                const tp = parseFloat(pos.targetPrice || plan.trade.tp1);

                                                if (currentPrice <= sl) {
                                                    return (
                                                        <div className="p-3 rounded-xl border-l-4 bg-red-500/10 border-red-500/50">
                                                            <p className="text-[13px] font-bold text-red-400 leading-tight">
                                                                BAHAYA: Harga jatuh bawah Stop Loss. Cadangan: EXIT Segera untuk lindungi modal.
                                                            </p>
                                                        </div>
                                                    );
                                                } else if (currentPrice >= tp) {
                                                    return (
                                                        <div className="p-3 rounded-xl border-l-4 bg-emerald-500/10 border-emerald-500/50">
                                                            <p className="text-[13px] font-bold text-emerald-400 leading-tight">
                                                                TARGET DICAPAI: Ambil peluang untuk kunci keuntungan (Lock Profit) sekarang.
                                                            </p>
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div className="p-3 rounded-xl border-l-4 bg-blue-500/10 border-blue-500/50">
                                                            <p className="text-[13px] font-bold text-blue-300 leading-tight">
                                                                PENGURUSAN AKTIF: Posisi masih dalam zon selamat. Kekal pegang (HOLD) mengikut pelan.
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                            }

                                            // Default entry logic
                                            return (
                                                <div className={`p-3 rounded-xl border-l-4 ${plan.verdictLabel?.includes('GO') ? 'bg-emerald-500/10 border-emerald-500/50' : (plan.verdictLabel === 'AVOID' ? 'bg-red-500/10 border-red-500/50' : 'bg-indigo-500/10 border-indigo-500/50')}`}>
                                                    <p className={`text-[13px] font-bold leading-tight ${plan.verdictLabel?.includes('GO') ? 'text-emerald-400' : (plan.verdictLabel === 'AVOID' ? 'text-red-400' : 'text-indigo-300')}`}>
                                                        {plan.systemVerdictText || (alignment >= 2 ? "READY TO GO: Isyarat teknikal selari pada pelbagai jangka masa." : "TUNGGU: Trend teknikal masih lemah. Pantau isyarat reversal.")}
                                                    </p>
                                                </div>
                                            );
                                        })()}

                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest leading-none mb-1 text-center">Price</span>
                                                    <span className="text-white font-black text-sm">{currency} {(parseFloat(plan.price) || 0).toFixed(3)}</span>
                                                    {plan.open && (
                                                        <span className="text-[8px] text-gray-400 font-bold uppercase mt-1">Open: {((parseFloat(plan.open) || 0).toFixed(3))}</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col border-l border-white/10 pl-3 items-center">
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
                                ticker={stock.ticker}
                                currentPrice={plan?.price || stock.close}
                                market={stock.market || market}
                                existingPosition={positions[stock.ticker]}
                                technicalLevels={plan.trade}
                                recommendedStrategy={strategy}
                                onSave={onSavePosition}
                                onRemove={onRemovePosition}
                                onSell={(sellData) => {
                                    if (!onSellPosition) return;
                                    const pos = positions[stock.ticker];
                                    return onSellPosition({
                                        ...sellData,
                                        ticker_full: stock.ticker_full || stock.ticker,
                                        entry_price: pos?.entryPrice,
                                        strategy: pos?.strategy,
                                        buy_date: pos?.buyDate
                                    });
                                }}
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
                                            <td className="p-3 text-right font-mono text-white font-black">{formatValue(plan.indicators.ma20)}</td>
                                        </tr>
                                        <tr className="group hover:bg-white/5">
                                            <td className="p-3 text-gray-500 font-bold uppercase tracking-tighter">MA 50 (Med)</td>
                                            <td className="p-3 text-right font-mono text-white font-black">{formatValue(plan.indicators.ma50)}</td>
                                        </tr>
                                        <tr className="group hover:bg-white/5">
                                            <td className="p-3 text-gray-500 font-bold uppercase tracking-tighter">MA 200 (Long)</td>
                                            <td className="p-3 text-right font-mono text-white font-black">{formatValue(plan.indicators.ma200)}</td>
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

                            {/* Main Verdict Card - moved to top */}
                            {/* Main Verdict Card - moved to top */}
                            {(() => {
                                let displayVerdict = plan.verdictLabel || "WAIT";
                                let vColorClass = "bg-primary/10 border-primary/20 shadow-primary/10";
                                let vLabelColorClass = "text-primary";
                                let vIconBgClass = "bg-primary";
                                let vIcon = <Activity className="w-8 h-8" />;
                                let vAdvice = plan.systemVerdictText || (displayVerdict?.includes('GO') ? "Isyarat cukup syarat untuk entri mengikut strategi." : (displayVerdict === 'AVOID' ? "Nisbah risiko-ganjaran tidak menarik. Lebihkan tunai." : "Isyarat belum cukup kuat untuk keputusan beli. Tunggu 'alignment' berlaku."));

                                if (pos) {
                                    const currentPrice = plan.price || stock.close;
                                    const sl = parseFloat(pos.stopLoss);
                                    const tp = parseFloat(pos.targetPrice || plan.trade.tp1);

                                    if (currentPrice <= sl) {
                                        displayVerdict = "EXIT (SL)";
                                        vColorClass = "bg-red-500/10 border-red-500/20 shadow-red-500/10 animate-pulse";
                                        vLabelColorClass = "text-red-400";
                                        vIconBgClass = "bg-red-500";
                                        vIcon = <TrendingDown className="w-8 h-8" />;
                                        vAdvice = "POTONG RUGI: Harga sudah mencecah Stop Loss. Lindungi baki modal anda.";
                                    } else if (currentPrice >= tp) {
                                        displayVerdict = "EXIT (TP)";
                                        vColorClass = "bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10 animate-bounce-subtle";
                                        vLabelColorClass = "text-emerald-400";
                                        vIconBgClass = "bg-emerald-500";
                                        vIcon = <Zap className="w-8 h-8" />;
                                        vAdvice = "AMBIL UNTUNG: Harga sudah mencecah Target Profit. Tahniah!";
                                    } else {
                                        displayVerdict = "HOLDING";
                                        vColorClass = "bg-blue-500/10 border-blue-500/20 shadow-blue-500/10";
                                        vLabelColorClass = "text-blue-400";
                                        vIconBgClass = "bg-blue-500";
                                        vIcon = <Activity className="w-8 h-8" />;
                                        vAdvice = "KEKAL PEGANG: Posisi anda masih sihat. Pantau paras Stop Loss.";
                                    }
                                } else {
                                    // Use plan verdict logic
                                    if (displayVerdict?.includes('GO')) {
                                        vColorClass = "bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10";
                                        vLabelColorClass = "text-emerald-400";
                                        vIconBgClass = "bg-emerald-500";
                                        vIcon = <TrendingUp className="w-8 h-8" />;
                                    } else if (displayVerdict === 'AVOID' || displayVerdict?.includes('SELL')) {
                                        vColorClass = "bg-red-500/10 border-red-500/20 shadow-red-500/10";
                                        vLabelColorClass = "text-red-400";
                                        vIconBgClass = "bg-red-500";
                                        vIcon = <TrendingDown className="w-8 h-8" />;
                                    }
                                }

                                return (
                                    <div className={`p-6 rounded-3xl border shadow-2xl transition-all duration-500 ${vColorClass}`}>
                                        <div className="flex flex-col gap-6">
                                            <div className="flex items-center gap-5">
                                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-3 ${vIconBgClass} text-white`}>
                                                    {vIcon}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">System Verdict</div>
                                                    <div className={`text-3xl font-black tracking-tighter ${vLabelColorClass}`}>
                                                        {displayVerdict}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="w-full">
                                                <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-1">
                                                            {displayVerdict?.includes('GO') || displayVerdict?.includes('TP') ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Info className="w-4 h-4 text-blue-400" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-[13px] font-bold text-white leading-relaxed">
                                                                {vAdvice}
                                                            </p>
                                                            {plan.trade.strategyLabel && !pos && (
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
                                );
                            })()}

                            {/* Recommendation Card */}
                            {(() => {
                                const verdict = plan.verdictLabel;
                                const conviction = plan.convictionPct;
                                const rrNum = plan.trade?.rrRatio || 0;

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
                                            {(() => {
                                                const verdictLabel = plan.verdictLabel || "NEUTRAL";
                                                const conviction = plan.convictionPct || 0;
                                                const currentPrice = plan.price || stock.close;
                                                const confirmedCount = plan.multiTimeframe?.confirmedCount || 0;

                                                let topValue = 40;
                                                let topLabel = verdictLabel;
                                                let topColor = "#f59e0b"; // Default Neutral

                                                if (verdictLabel.includes('EXIT (SL)') || verdictLabel === 'AVOID') {
                                                    topValue = 12.5;
                                                    topColor = "#ef4444";
                                                }
                                                else if (verdictLabel.includes('EXIT (TP)') || verdictLabel === 'GO' || verdictLabel === 'DOUBLE GO') {
                                                    topValue = 87.5;
                                                    topColor = "#10b981";
                                                }
                                                else if (verdictLabel === 'HOLDING' || verdictLabel === 'WAIT' || verdictLabel?.includes('MONITOR')) {
                                                    topValue = 62.5;
                                                    topColor = "#3b82f6";
                                                }

                                                let bottomValue = conviction;
                                                let bottomLabel = "CONVICTION";

                                                if (pos) {
                                                    bottomLabel = "POSITION ACTION";
                                                    const sl = parseFloat(pos.stopLoss);
                                                    const tp = parseFloat(pos.targetPrice || plan.trade?.tp1);

                                                    if (currentPrice <= sl) bottomValue = 12.5;
                                                    else if (currentPrice >= tp) bottomValue = 87.5;
                                                    else bottomValue = 62.5;
                                                } else {
                                                    const isAvoid = verdictLabel === 'AVOID' || verdictLabel?.includes('SELL');
                                                    const isBearishConviction = (plan.sentiment4h === 'BEARISH' || confirmedCount === 0);

                                                    if (isAvoid && isBearishConviction) {
                                                        bottomValue = Math.min(bottomValue, 15);
                                                    } else if (isAvoid || isBearishConviction) {
                                                        bottomValue = Math.min(bottomValue, 40);
                                                    }
                                                }

                                                return (
                                                    <div className="flex flex-col items-center gap-8 py-4">
                                                        <div className="w-full flex flex-col items-center">
                                                            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Technical Decision</h4>
                                                            <GaugeMeter
                                                                value={topValue}
                                                                label={topLabel}
                                                                color={topColor}
                                                                loading={loadingTradePlan}
                                                                isPortfolio={false}
                                                            />
                                                        </div>

                                                        <div className="w-full flex flex-col items-center">
                                                            <GaugeMeter
                                                                value={bottomValue}
                                                                label={bottomLabel}
                                                                color={bottomValue < 30 ? "#ef4444" : "#6366f1"}
                                                                loading={loadingTradePlan}
                                                                isPortfolio={!!pos}
                                                                variant={pos ? null : "conviction"}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Status Boxes */}
                                            <div className="w-full grid grid-cols-2 gap-4 mt-6">
                                                <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 transition-all group/stat">
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.1em] mb-2 group-hover/stat:text-gray-400 transition-colors">RSI (14)</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-2xl font-black ${parseFloat(plan.indicators.rsi14) >= 70 ? 'text-red-400' : (parseFloat(plan.indicators.rsi14) <= 35 ? 'text-emerald-400' : 'text-white')}`}>
                                                            {formatValue(plan.indicators.rsi14, 1)}
                                                        </span>
                                                        <span className="text-[9px] text-gray-500 font-black uppercase bg-white/5 px-2 py-0.5 rounded-md self-center">{parseFloat(plan.indicators.rsi14) >= 70 ? 'O/Bought' : (parseFloat(plan.indicators.rsi14) <= 35 ? 'O/Sold' : 'Neutral')}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 transition-all group/stat">
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.1em] mb-2 group-hover/stat:text-gray-400 transition-colors">Daily Alignment</div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-2xl font-black ${plan.multiTimeframe.tf1d ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {plan.multiTimeframe.tf1d ? 'ALIGNED' : 'WEAK'}
                                                        </span>
                                                        <div className={`w-2.5 h-2.5 rounded-full ${plan.multiTimeframe.tf1d ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Wait for RR 2.0 Pricing Notice - Only show if NO active position */}
                                            {!pos && plan.trade?.queuePrice && parseFloat(plan.price) > parseFloat(plan.trade.queuePrice) && (
                                                <div className="w-full mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden group/notice animate-in slide-in-from-top-2 duration-500">
                                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                                        <Clock className="w-12 h-12 text-emerald-400" />
                                                    </div>
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Wait for RR 2.0 @</span>
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                            </div>
                                                            <div className="text-4xl font-black text-emerald-400 tracking-tighter">
                                                                <span className="text-xl text-emerald-500/60 mr-2">{currency}</span>
                                                                {parseFloat(plan.trade.queuePrice).toFixed(3)}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col md:items-end gap-2">
                                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Que Strategy</span>
                                                            <div className="bg-emerald-500/20 text-emerald-400 px-5 py-2 rounded-xl border border-emerald-500/30 font-black text-[11px] uppercase tracking-wider shadow-lg shadow-emerald-500/5">
                                                                (ADVANTAGE QUE)
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Checklist Section - Show ENTRY checklist if NO position, or HOLDING checklist if position exists */}
                                            {((!pos && plan.checklist?.length > 0) || (pos && plan.holdingChecklist?.length > 0)) && (
                                                <div className="w-full mt-6 space-y-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                                            {pos
                                                                ? '🛡️ Status Pegangan (Management)'
                                                                : (plan.verdictLabel === 'DOUBLE GO' ? '🔥 DOUBLE GO Checklist' : 'Saringan Masuk (Checklist)')
                                                            }
                                                        </h4>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-bold text-emerald-500">
                                                                {(pos ? plan.holdingChecklist : plan.checklist).filter(c => c.passed).length}/{(pos ? plan.holdingChecklist : plan.checklist).length}
                                                            </span>
                                                            <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-emerald-500 transition-all duration-1000"
                                                                    style={{
                                                                        width: `${((pos ? plan.holdingChecklist : plan.checklist).filter(c => c.passed).length / (pos ? plan.holdingChecklist : plan.checklist).length) * 100}%`
                                                                    }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {(pos ? plan.holdingChecklist : plan.checklist).map((item, idx) => (
                                                            <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${item.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/5 opacity-60'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${item.passed ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-600'}`}>
                                                                        <CheckCircle className="w-3 h-3" strokeWidth={3} />
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className={`text-[11px] font-black uppercase tracking-tight ${item.passed ? 'text-white' : 'text-gray-500'}`}>{item.label}</span>
                                                                        {item.note && <span className="text-[9px] text-gray-500 font-medium">{item.note}</span>}
                                                                    </div>
                                                                </div>
                                                                <span className={`text-[10px] font-black ${item.passed ? 'text-emerald-400' : 'text-gray-600'}`}>{item.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Execution Summary Card - moved here */}
                                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden group/exec animate-in fade-in slide-in-from-right-4 duration-700">
                                            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover/exec:opacity-[0.07] transition-opacity pointer-events-none rotate-12">
                                                <Zap className="w-32 h-32 text-emerald-400" />
                                            </div>
                                            <div className="space-y-5">
                                                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                                            <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] leading-none mb-1">Pelan Tindakan Segera</h3>
                                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none">Quick Execution Summary</span>
                                                        </div>
                                                    </div>
                                                    {/* Copy to WhatsApp button */}
                                                    <button
                                                        onClick={() => {
                                                            const shortName = stock.short_name || plan.raw?.liveStock?.shortName || stock.company_name?.split(' ')[0] || stock.company?.split(' ')[0] || (favouriteDetails && favouriteDetails[stock.ticker]?.short_name) || stock.ticker?.replace('.KL', '') || stock.ticker || 'SAHAM';
                                                            const tickerLabel = stock.ticker || '';
                                                            const entryRange = plan.trade.queuePrice?.toFixed(3) === plan.trade.entryPrice?.toFixed(3)
                                                                ? `${currency} ${plan.trade.entryPrice?.toFixed(3) || '0.000'}`
                                                                : `${currency} ${plan.trade.queuePrice?.toFixed(3) || '0.000'} - ${plan.trade.entryPrice?.toFixed(3) || '0.000'}`;
                                                            const msg = [
                                                                `📊 *${shortName}* (${tickerLabel})`,
                                                                ``,
                                                                `📈 Entry Range: ${entryRange}`,
                                                                `🛑 Stop Loss: ${currency} ${plan.trade.stopLoss?.toFixed(3) || '0.000'} & Below`,
                                                                `🎯 TP1: ${plan.trade.tp1?.toFixed(3) || '-'} | TP2: ${plan.trade.tp2?.toFixed(3) || '-'}`,
                                                                `⏰ Tempoh: 1-20 Trading Days`,
                                                                ``,
                                                                `💰 Harga Semasa: ${currency} ${parseFloat(plan.price || 0).toFixed(3)}`,
                                                            ].join('\n');
                                                            navigator.clipboard.writeText(msg).then(() => {
                                                                setCopiedPlan(true);
                                                                setTimeout(() => setCopiedPlan(false), 2000);
                                                            });
                                                        }}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${copiedPlan
                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                                                            }`}
                                                        title="Copy untuk WhatsApp"
                                                    >
                                                        {copiedPlan ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                        {copiedPlan ? 'Copied!' : 'Copy'}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/5 group-hover/exec:border-emerald-500/10 transition-colors">
                                                        <div className="flex items-center gap-1.5">
                                                            <TrendingUp className="w-3 h-3 text-gray-500" />
                                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Entry Range</span>
                                                        </div>
                                                        <div className="text-sm font-black text-white tracking-tight">
                                                            {currency} {plan.trade.queuePrice?.toFixed(3) === plan.trade.entryPrice?.toFixed(3)
                                                                ? (plan.trade.entryPrice?.toFixed(3) || '0.000')
                                                                : `${plan.trade.queuePrice?.toFixed(3) || '0.000'} - ${plan.trade.entryPrice?.toFixed(3) || '0.000'}`
                                                            }
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5 p-3 rounded-2xl bg-red-500/5 border border-red-500/5 group-hover/exec:border-red-500/10 transition-colors">
                                                        <div className="flex items-center gap-1.5">
                                                            <AlertOctagon className="w-3 h-3 text-red-400/50" />
                                                            <span className="text-[9px] font-bold text-red-400/50 uppercase tracking-widest">Stop Loss</span>
                                                        </div>
                                                        <div className="text-sm font-black text-red-400 tracking-tight">
                                                            {currency} {plan.trade.stopLoss?.toFixed(3) || '0.000'} <span className="text-[10px]">&amp; BELOW</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/10 group-hover/exec:border-emerald-500/30 transition-all">
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <Target className="w-3 h-3 text-emerald-400" />
                                                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Target Profit (TP1 / TP2)</span>
                                                    </div>
                                                    <div className="text-lg font-black text-white tracking-tighter flex items-center justify-between">
                                                        <span>{plan.trade.tp1?.toFixed(3)}</span>
                                                        <span className="text-white/20">/</span>
                                                        <span>{plan.trade.tp2?.toFixed(3)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between px-1">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3 h-3 text-blue-400" />
                                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Trade Duration</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                        1 - 20 Trading Days
                                                    </span>
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

                            {/* Telegram Smart Alerts */}
                            {isFav && (
                                <div className="space-y-3 pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-2 py-1">
                                        <Bell className="w-3.5 h-3.5 text-gray-400" />
                                        <h3 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Telegram Smart Alerts</h3>
                                    </div>

                                    <div className={`grid ${pos ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                                        {(() => {
                                            const detail = favouriteDetails[stock.ticker_full || stock.ticker] || {};

                                            if (pos) {
                                                // Owned: Show compact TP/SL buttons
                                                return (
                                                    <>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newSettings = {
                                                                    alert_go: false,
                                                                    alert_tp: !detail.alert_tp,
                                                                    alert_sl: detail.alert_sl || false
                                                                };
                                                                onToggleAlert(stock.ticker_full || stock.ticker, null, newSettings);
                                                            }}
                                                            className={`relative overflow-hidden p-3 rounded-2xl border transition-all duration-300 group ${detail.alert_tp
                                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                                : 'bg-white/5 border-white/5 hover:bg-white/10 opacity-60'}`}
                                                        >
                                                            <div className="flex flex-col items-center gap-2 relative z-10">
                                                                <TrendingUp className={`w-5 h-5 ${detail.alert_tp ? 'text-emerald-400' : 'text-gray-600'}`} />
                                                                <span className={`text-[10px] font-black uppercase tracking-widest ${detail.alert_tp ? 'text-white' : 'text-gray-500'}`}>Target Price</span>
                                                                <div className={`h-1 w-8 rounded-full transition-all duration-500 ${detail.alert_tp ? 'bg-emerald-500' : 'bg-transparent'}`}></div>
                                                            </div>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newSettings = {
                                                                    alert_go: false,
                                                                    alert_tp: detail.alert_tp || false,
                                                                    alert_sl: !detail.alert_sl
                                                                };
                                                                onToggleAlert(stock.ticker_full || stock.ticker, null, newSettings);
                                                            }}
                                                            className={`relative overflow-hidden p-3 rounded-2xl border transition-all duration-300 group ${detail.alert_sl
                                                                ? 'bg-red-500/10 border-red-500/30'
                                                                : 'bg-white/5 border-white/5 hover:bg-white/10 opacity-60'}`}
                                                        >
                                                            <div className="flex flex-col items-center gap-2 relative z-10">
                                                                <TrendingDown className={`w-5 h-5 ${detail.alert_sl ? 'text-red-400' : 'text-gray-600'}`} />
                                                                <span className={`text-[10px] font-black uppercase tracking-widest ${detail.alert_sl ? 'text-white' : 'text-gray-500'}`}>Stop Loss</span>
                                                                <div className={`h-1 w-8 rounded-full transition-all duration-500 ${detail.alert_sl ? 'bg-red-500' : 'bg-transparent'}`}></div>
                                                            </div>
                                                        </button>
                                                    </>
                                                );
                                            } else {
                                                // Not owned: Show compact Signal Go button
                                                const isActive = detail.alert_go;
                                                return (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newSettings = {
                                                                alert_go: !isActive,
                                                                alert_tp: false,
                                                                alert_sl: false
                                                            };
                                                            onToggleAlert(stock.ticker_full || stock.ticker, null, newSettings);
                                                        }}
                                                        className={`relative overflow-hidden p-4 rounded-2xl border transition-all duration-300 group ${isActive
                                                            ? 'bg-indigo-500/10 border-indigo-500/30'
                                                            : 'bg-white/5 border-white/5 hover:bg-white/10 opacity-60'}`}
                                                    >
                                                        <div className="flex flex-col items-center gap-2 relative z-10">
                                                            <Activity className={`w-6 h-6 ${isActive ? 'text-indigo-400 animate-pulse' : 'text-gray-600'}`} />
                                                            <span className={`text-sm font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-gray-500'}`}>Activate Signal GO</span>
                                                            <div className={`h-1 w-10 rounded-full transition-all duration-500 ${isActive ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                                                        </div>
                                                    </button>
                                                );
                                            }
                                        })()}
                                    </div>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest text-center opacity-50 leading-relaxed px-4">
                                        {pos
                                            ? "Pantauan harga TP/SL secara automatik."
                                            : "Terima isyarat terus ke Telegram anda."}
                                    </p>
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
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-black block mb-1.5 tracking-widest">TP 1</label>
                                            <div className="text-lg font-black text-emerald-400">{currency} {(plan.trade?.tp1 || stock.levels?.target1 || 0).toFixed(3)}</div>
                                            <div className="text-[9px] text-emerald-500/60 font-bold">+{(((plan.trade?.tp1 || stock.levels?.target1 || 0) - plan.price) / plan.price * 100).toFixed(1)}%</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-black block mb-1.5 tracking-widest">TP 2</label>
                                            <div className="text-lg font-black text-teal-400">{currency} {(plan.trade?.tp2 || stock.levels?.target2 || 0).toFixed(3)}</div>
                                            <div className="text-[9px] text-teal-500/60 font-bold">+{(((plan.trade?.tp2 || stock.levels?.target2 || 0) - plan.price) / plan.price * 100).toFixed(1)}%</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-black block mb-1.5 tracking-widest">SL (Exit)</label>
                                            <div className="text-lg font-black text-red-400">{currency} {(plan.trade?.stopLoss || stock.levels?.stopPrice || 0).toFixed(3)}</div>
                                            <div className="text-[9px] text-red-500/60 font-bold">-{((plan.price - (plan.trade?.stopLoss || stock.levels?.stopPrice || 0)) / plan.price * 100).toFixed(1)}%</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col justify-center items-center text-center">
                                    <div className="text-[10px] text-gray-500 uppercase font-black mb-2 tracking-widest text-emerald-500/80">RR (TP1) Status</div>
                                    <div className={`text-3xl font-black mb-1 ${(plan.trade?.rrRatio || stock.levels?.rr1 || 0) >= 2.0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                        {(plan.trade?.rrRatio || stock.levels?.rr1 || 0).toFixed(2)}
                                    </div>
                                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest opacity-50">Risk Reward Ratio (TP1)</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Inline Chart Drawer */}
                    {showChart && (
                        <div className="mt-8 pt-8 border-t border-white/5 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h3 className="text-[10px] font-black text-primary flex items-center gap-2 uppercase tracking-[0.2em]">
                                    <BarChart2 className="w-4 h-4" /> Live Interactive Chart
                                </h3>
                                <button
                                    onClick={() => setShowChart(false)}
                                    className="text-[9px] font-black text-gray-500 hover:text-white uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg border border-white/5 transition-all"
                                >
                                    Close Chart
                                </button>
                            </div>
                            <div className="w-full bg-black/40 rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative" style={{ height: '50vh', minHeight: '400px' }}>
                                <TradingViewWidget key={stock.ticker} ticker={stock.ticker} market={market} stock={stock} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - Sticky Bottom */}
                <div className="sticky bottom-0 z-30 p-6 md:p-8 border-t border-white/5 bg-surfaceHighlight/50 backdrop-blur-xl flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4 md:gap-6">
                        {!isBursa ? (
                            <>
                                <button
                                    onClick={() => setShowChart(!showChart)}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 border ${showChart
                                        ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/20'
                                        : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`}
                                >
                                    <BarChart2 className="w-4 h-4" />
                                    {showChart ? 'Tutup Carta' : 'Lihat Carta'}
                                </button>
                                <a
                                    href={`https://www.tradingview.com/chart/?symbol=${normalizeTradingViewSymbol(stock.ticker, market, stock)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-black text-gray-500 hover:text-primary uppercase tracking-widest transition-all flex items-center gap-1.5"
                                >
                                    <ExternalLink className="w-3 h-3" /> New Tab
                                </a>
                            </>
                        ) : (
                            <a
                                href={`https://www.tradingview.com/chart/?symbol=${normalizeTradingViewSymbol(stock.ticker, market, stock)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 border bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/40"
                            >
                                <ExternalLink className="w-4 h-4" /> Buka Carta (New Tab)
                            </a>
                        )}
                    </div>

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
