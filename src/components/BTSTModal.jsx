import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShoppingCart, TrendingUp, AlertTriangle, ArrowRight, Zap, Target, BarChart3, Clock, DollarSign, Star, AlertCircle, Info, Gavel, ShieldCheck, ChevronDown, ChevronUp, ArrowDown, ArrowUp } from 'lucide-react';

const BTSTModal = ({ stock, isOwned, onClose }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [liveData, setLiveData] = useState(null);
    const [investmentAmount, setInvestmentAmount] = useState(1000); // Default RM 1000
    const [targetSellPrice, setTargetSellPrice] = useState(0);
    const [isStillBtst, setIsStillBtst] = useState(true);
    const [isSimulatorExpanded, setIsSimulatorExpanded] = useState(true);
    const [isCoachPlanExpanded, setIsCoachPlanExpanded] = useState(true);
    const [refreshTimer, setRefreshTimer] = useState(10); // Countdown for next update

    // Live Polling Effect
    useEffect(() => {
        if (!stock) return;

        const fetchData = async () => {
            try {
                // ... fetch logic items ...
                const [priceRes, btstRes] = await Promise.all([
                    fetch(`/.netlify/functions/getLatestPrices?tickers=${stock.ticker}`),
                    fetch(`/.netlify/functions/getBtstLatest`)
                ]);
                
                if (priceRes.ok) {
                    const data = await priceRes.json();
                    if (data && data[stock.ticker]) {
                        setLiveData(data[stock.ticker]);
                        setRefreshTimer(10); // Reset timer on successful fetch
                    }
                }
                
                if (btstRes.ok) {
                    const btstData = await btstRes.json();
                    const stillInList = btstData.some(s => s.ticker === stock.ticker);
                    setIsStillBtst(stillInList);
                }
            } catch (err) {
                console.error("Live polling error:", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000); // 10 seconds polling
        return () => clearInterval(interval);
    }, [stock.ticker]);

    // Timer Countdown Effect
    useEffect(() => {
        const timer = setInterval(() => {
            setRefreshTimer(prev => prev > 0 ? prev - 1 : 10);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Initialize target price once stock is loaded
    useEffect(() => {
        if (stock && targetSellPrice === 0) {
            setTargetSellPrice(parseFloat((stock.close * 1.03).toFixed(3))); // Suggest +3%
        }
    }, [stock]);

    if (!stock) return null;

    const currentPrice = liveData?.close || stock.close;
    const currentChange = liveData?.plan?.analysis?.currentChangePercent || stock.changePercent;
    
    // Simulation Calculations
    const totalShares = Math.floor(investmentAmount / (currentPrice || 1) / 100) * 100;
    const actualInvestment = totalShares * currentPrice;
    const potentialRevenue = totalShares * targetSellPrice;
    const potentialProfit = potentialRevenue - actualInvestment;
    const potentialProfitPercent = ((targetSellPrice - currentPrice) / currentPrice) * 100;

    // Calculate P/L if owned
    const plPercent = currentPrice && stock.close ? ((currentPrice - stock.close) / stock.close) * 100 : 0;
    
    // Alert logic based on Coach's Plan
    const stopLevel = stock.planType === 'Breakout' ? stock.rbsPrice : stock.supportPrice;
    const isAlertActive = currentPrice <= stopLevel;

    // Entry and Live P/L Logic
    const entryPrice = isOwned ? (stock.entry_price || stock.close) : stock.close;
    const livePnL = (currentPrice - entryPrice) * totalShares;
    const livePnLPercent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

    // determine Live Action Status
    const getActionStatus = () => {
        const now = new Date();
        const hrs = now.getHours();
        const mins = now.getMinutes();
        const currentTimeVal = hrs * 100 + mins;

        if (isOwned) {
            if (currentTimeVal >= 900 && currentTimeVal <= 1030) {
                return { label: 'SELL NOW', color: 'bg-rose-500', text: 'Waktu Puncak Jual BTST', icon: <Gavel className="w-3 h-3" />, glow: 'shadow-rose-500/50' };
            }
            return { label: 'HOLDING', color: 'bg-emerald-500', text: 'Pantau Paras Cut Loss', icon: <ShieldCheck className="w-3 h-3" />, glow: 'shadow-emerald-500/50' };
        }

        if (!isStillBtst) {
            return { label: 'DROP/AVOID', color: 'bg-gray-600', text: 'Saham Terkeluar BTST', icon: <X className="w-3 h-3" />, glow: '' };
        }

        if (isAlertActive) {
            return { label: 'AVOID', color: 'bg-rose-600', text: 'Harga Bawah Support', icon: <AlertCircle className="w-3 h-3" />, glow: 'shadow-rose-600/50' };
        }

        // BTST Buy Window (4:40 PM - 5:00 PM)
        if (currentTimeVal >= 1640 && currentTimeVal <= 1700) {
            return { label: 'BUY NOW !!!', color: 'bg-indigo-600', text: 'Momentum Penutupan Kuat', icon: <Zap className="w-3 h-3" />, glow: 'shadow-indigo-600/50 animate-pulse' };
        }

        // Monitoring Phase (After 3:30 PM but before 4:40 PM)
        if (currentTimeVal >= 1530 && currentTimeVal < 1640) {
            return { label: 'MONITORING', color: 'bg-amber-500', text: 'Tunggu Minit Akhir', icon: <Clock className="w-3 h-3" />, glow: 'shadow-amber-500/20' };
        }

        return { label: 'WAITING', color: 'bg-indigo-500/40', text: 'Belum Waktu BTST', icon: <Clock className="w-3 h-3" />, glow: '' };
    };

    const actionStatus = getActionStatus();

    const handleMarkOwned = async () => {
        try {
            setIsSaving(true);
            const response = await fetch('/.netlify/functions/savePosition', {
                method: 'POST',
                body: JSON.stringify({
                    ticker_full: stock.ticker,
                    entry_price: currentPrice,
                    quantity: totalShares,
                    strategy: 'BTST'
                })
            });
            if (response.ok) {
                onClose();
            }
        } catch (err) {
            console.error('Ralat semasa menyimpan:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMarkSold = async () => {
        try {
            setIsSaving(true);
            const response = await fetch('/.netlify/functions/removePosition', {
                method: 'POST',
                body: JSON.stringify({ ticker_full: stock.ticker })
            });
            if (response.ok) {
                onClose();
            }
        } catch (err) {
            console.error('Ralat semasa membuang:', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className={`
                relative w-full max-w-xl bg-[#0f0f12] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden
                ${isOwned ? 'ring-1 ring-emerald-500/20 shadow-emerald-500/5' : 'ring-1 ring-indigo-500/20 shadow-indigo-500/5'}
                ${isAlertActive ? 'ring-2 ring-rose-500 shadow-rose-500/20' : ''}
            `}>
                {/* Alert Banner for Aggressive Action */}
                {isAlertActive && isStillBtst && (
                    <div className="bg-rose-600 px-6 py-2.5 flex items-center justify-center gap-2 animate-pulse">
                        <AlertCircle className="w-4 h-4 text-white" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">
                            Amaran: Harga Bawah Aras {stock.planType === 'Breakout' ? 'RBS' : 'Support'}!
                        </span>
                    </div>
                )}

                {/* Dropped Banner */}
                {!isStillBtst && !isOwned && (
                    <div className="bg-amber-600 px-6 py-3 flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-white" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                NOTA: Saham ini tidak lagi berada dalam senarai BTST
                            </span>
                        </div>
                        <p className="text-[9px] text-white/80 font-bold">Imbasan terbaru menunjukkan saham ini tidak menepati kriteria skor tinggi.</p>
                    </div>
                )}

                {/* Header Section */}
                <div className={`p-8 pb-6 bg-gradient-to-b ${isOwned ? 'from-emerald-950/20' : 'from-indigo-950/20'} to-transparent`}>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 ${isOwned ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'}`}>
                                    {isOwned ? <ShoppingCart className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                                    {isOwned ? 'Pegangan BTST' : 'Calon BTST'}
                                </div>
                                <div className="bg-white/5 text-gray-400 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border border-white/5 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                    LIVE SCORE {stock.score}/9
                                    <span className="text-white/20 px-1">|</span>
                                    <span className="text-indigo-400 tabular-nums">RENEW IN {refreshTimer}S</span>
                                </div>
                            </div>
                            <h2 className="text-3xl font-black tracking-tighter uppercase leading-tight">{stock.company}</h2>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs tracking-tighter">{stock.ticker}</p>
                                <a 
                                    href={`https://www.tradingview.com/chart/?symbol=MYX:${stock.ticker.split('.')[0]}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-blue-500/20 transition-all flex items-center gap-1"
                                >
                                    <BarChart3 className="w-3 h-3" />
                                    TradingView
                                </a>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white p-3 rounded-2xl transition-all active:scale-90"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl relative">
                            <div className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping"></div>
                                Cadangan Entry
                            </div>
                            <div className="text-xl font-black text-white">RM {currentPrice.toFixed(3)}</div>
                            <div className="mt-2 flex items-center gap-2">
                                <div className={`${actionStatus.color} ${actionStatus.glow} px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-lg`}>
                                    {actionStatus.icon}
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter italic">
                                        {actionStatus.label}
                                    </span>
                                </div>
                                <span className="text-[9px] text-gray-500 font-bold tracking-tight">
                                    {actionStatus.text}
                                </span>
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl relative">
                            <div className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                Target Jual (BTST)
                            </div>
                            <div className="text-xl font-black text-emerald-500">RM {targetSellPrice.toFixed(3)}</div>
                            <div className="text-[10px] text-gray-500 font-bold mt-1">Potensi +3.00% Profit</div>
                        </div>
                    </div>

                    {/* Live Price Progress Bar */}
                    <div className="mt-8 px-2">
                        <div className="flex justify-between items-end mb-2">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Stop Loss</span>
                                <span className="text-xs font-black text-white">RM {stopLevel.toFixed(3)}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 mb-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Harga Semasa</span>
                                </div>
                                <span className="text-lg font-black text-white">RM {currentPrice.toFixed(3)}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Target Jual</span>
                                <span className="text-xs font-black text-white">RM {targetSellPrice.toFixed(3)}</span>
                            </div>
                        </div>

                        {/* The Actual Bar with Dynamic Zones */}
                        <div className="relative h-4 bg-white/5 rounded-full border border-white/5 overflow-visible">
                            {/* Dynamic Zones Calculation */}
                            {(() => {
                                const range = targetSellPrice - stopLevel;
                                const entryProgress = ((entryPrice - stopLevel) / (range || 1)) * 100;
                                
                                return (
                                    <div className="absolute inset-0 flex rounded-full overflow-hidden">
                                        {/* Danger Zone (Entry to SL) */}
                                        <div 
                                            className="h-full bg-rose-500/10 border-r border-rose-500/30 transition-all duration-1000"
                                            style={{ width: `${Math.min(Math.max(entryProgress, 0), 100)}%` }}
                                        ></div>
                                        {/* Holding Zone (Entry to Target) */}
                                        <div 
                                            className="h-full bg-amber-500/20 border-r border-emerald-500/30 transition-all duration-1000"
                                            style={{ width: `${Math.min(Math.max(100 - entryProgress, 0), 100)}%` }}
                                        ></div>
                                    </div>
                                );
                            })()}
                            
                            {/* Entry Price Marker */}
                            {(() => {
                                const range = targetSellPrice - stopLevel;
                                const entryProgress = ((entryPrice - stopLevel) / (range || 1)) * 100;
                                const clampedEntry = Math.min(Math.max(entryProgress, -2), 102);

                                return (
                                    <div 
                                        className="absolute h-full border-l-2 border-dashed border-white/40 z-10"
                                        style={{ left: `${clampedEntry}%` }}
                                    >
                                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                            <ArrowUp className="w-3 h-3 text-white/50" />
                                            <span className="text-[7px] font-black text-white/40 uppercase whitespace-nowrap">Entry RM {entryPrice.toFixed(3)}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                            
                            {/* Price Indicator Marker */}
                            {(() => {
                                const range = targetSellPrice - stopLevel;
                                const progress = ((currentPrice - stopLevel) / (range || 1)) * 100;
                                const clampedProgress = Math.min(Math.max(progress, -5), 105);
                                
                                return (
                                    <div 
                                        className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out z-20"
                                        style={{ left: `${clampedProgress}%` }}
                                    >
                                        <div className="relative flex flex-col items-center">
                                            {/* P/L Tooltip */}
                                            <div className={`absolute -top-10 px-2 py-1 rounded-lg border text-[10px] font-black whitespace-nowrap shadow-xl transition-all ${livePnL >= 0 ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500' : 'bg-rose-500/20 border-rose-500/50 text-rose-500'}`}>
                                                {livePnL >= 0 ? '+' : ''}RM {livePnL.toFixed(2)} ({livePnLPercent.toFixed(2)}%)
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border-2 border-[#0f0f12] shadow-xl shadow-indigo-500/50 ${currentPrice <= stopLevel ? 'bg-rose-500' : currentPrice >= targetSellPrice ? 'bg-emerald-500' : 'bg-indigo-500'} animate-pulse`}></div>
                                            <ArrowDown className={`w-3 h-3 mt-1 ${currentPrice <= stopLevel ? 'text-rose-500' : currentPrice >= targetSellPrice ? 'text-emerald-500' : 'text-indigo-400'}`} />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        
                        <div className="flex justify-between mt-5">
                            <span className="text-[8px] font-black text-rose-500/60 uppercase tracking-widest">Zon Cut Loss</span>
                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.3em] bg-amber-500/10 px-3 py-0.5 rounded-full border border-amber-500/20">Zon Holding</span>
                            <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest">Zon Profit</span>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-0 space-y-6 overflow-y-auto max-h-[60vh]">
                    {/* Investment Simulator */}
                    <div className="bg-[#15151a] border border-white/5 rounded-3xl overflow-hidden shadow-inner">
                        <button 
                            onClick={() => setIsSimulatorExpanded(!isSimulatorExpanded)}
                            className="w-full p-6 pb-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                        >
                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <ShoppingCart className="w-3.5 h-3.5" />
                                Simulasi Keuntungan BTST
                            </h4>
                            {isSimulatorExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </button>
                        
                        {isSimulatorExpanded && (
                            <div className="px-6 pb-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Modal Pelaburan (RM)</label>
                                        <input 
                                            type="number" 
                                            value={investmentAmount}
                                            onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 text-white font-black px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Target Jual (RM)</label>
                                        <input 
                                            type="number" 
                                            step="0.005"
                                            value={targetSellPrice}
                                            onChange={(e) => setTargetSellPrice(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 text-emerald-500 font-black px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-bold uppercase tracking-tighter">Bilangan Saham (Units)</span>
                                        <span className="text-white font-black">{totalShares.toLocaleString()} Units</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500 font-bold uppercase tracking-tighter text-indigo-400">Sasaran Untung (Estimasi)</span>
                                        <div className="text-right">
                                            <div className="text-emerald-500 font-black tracking-tight text-lg">+RM {potentialProfit.toFixed(2)}</div>
                                            <div className="text-[9px] text-gray-500 font-bold">({potentialProfitPercent.toFixed(2)}% Gain)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Coach's Trading Plan */}
                    <div className="space-y-3">
                        <button 
                            onClick={() => setIsCoachPlanExpanded(!isCoachPlanExpanded)}
                            className="w-full flex items-center justify-between group"
                        >
                            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2 group-hover:text-gray-400">
                                <Star className="w-3.5 h-3.5 text-amber-400" />
                                Pelan Dagangan Coach
                            </h4>
                            {isCoachPlanExpanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                        </button>
                        
                        {isCoachPlanExpanded && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Setup Utama</div>
                                        <div className="text-sm font-black text-white flex items-center gap-2">
                                            {stock.planType === 'Breakout' ? 'BREAKOUT (RBS Strategy)' : 'SUPPORT PLAY'}
                                        </div>
                                    </div>
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">
                                            {stock.planType === 'Breakout' ? 'Aras RBS (Support Baru)' : 'Aras Support'}
                                        </div>
                                        <div className="text-sm font-black text-amber-400 tabular-nums">
                                            RM {stopLevel.toFixed(3)}
                                        </div>
                                    </div>
                                </div>

                                <div className={`rounded-2xl p-4 flex items-start gap-3 transition-all ${isAlertActive ? 'bg-rose-500/20 border border-rose-500/50 shadow-lg shadow-rose-900/20' : 'bg-rose-500/5 border border-rose-500/10'}`}>
                                    {isAlertActive ? <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-pulse" /> : <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                                    <div>
                                        <div className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isAlertActive ? 'text-rose-500' : 'text-gray-500'}`}>Aras Cut Loss (Wajib)</div>
                                        <p className={`text-[11px] font-medium leading-relaxed ${isAlertActive ? 'text-white' : 'text-gray-400'}`}>
                                            {isAlertActive ? `HARGA KRITIKAL! Sekarang RM ${currentPrice.toFixed(3)}. Keluar segera untuk kurangkan kerugian.` : `Jika harga jatuh bawah RM ${stopLevel.toFixed(3)}, strategi BTST terbatal.`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Live System Advice */}
                    <div className={`rounded-3xl p-5 border ${isOwned ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-indigo-500/5 border-indigo-500/10'}`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl ${isOwned ? 'bg-emerald-500/20 text-emerald-500' : 'bg-indigo-500/20 text-indigo-500'}`}>
                                <Zap className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className={`text-xs font-black uppercase tracking-widest ${isOwned ? 'text-emerald-500' : 'text-indigo-500'}`}>
                                        SISTEM LIVE ADVICE
                                    </h5>
                                    <div className="flex items-center gap-1.5 opacity-60">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                        <span className="text-[8px] font-black uppercase text-gray-400">Updating Live</span>
                                    </div>
                                </div>
                                <p className="text-[12px] font-bold text-white leading-relaxed">
                                    {liveData?.systemVerdictText || 'Analisa sedang dijana...'}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-gray-500" />
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                        {isOwned ? 'Paling lewat jual: 10:30 AM' : 'Waktu beli terbaik: 4:50 PM - 4:55 PM'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-4 pt-4 border-t border-white/5">
                        <button 
                            onClick={onClose}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl transition-all border border-white/5 active:scale-95"
                        >
                            Tutup
                        </button>
                        {isOwned ? (
                            <button 
                                onClick={handleMarkSold}
                                disabled={isSaving}
                                className="flex-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest py-4 px-8 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'Menyimpan...' : 'JUAL SEMUA POSISI'}
                            </button>
                        ) : (
                            <button 
                                onClick={handleMarkOwned}
                                disabled={isSaving}
                                className="flex-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest py-4 px-8 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'Menyimpan...' : (
                                    <>
                                        SAHKAN BELIAN (OWNED)
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BTSTModal;
