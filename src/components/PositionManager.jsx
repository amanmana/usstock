import React, { useState, useEffect } from 'react';
import { Save, Trash2, TrendingUp, BarChart2, DollarSign, Target, Hash, ShieldAlert, Calculator } from 'lucide-react';

export function PositionManager({ ticker, currentPrice, market, existingPosition, technicalLevels, recommendedStrategy, onSave, onRemove, onSell }) {
    const [entryPrice, setEntryPrice] = useState(existingPosition?.entryPrice || currentPrice || '');
    const [strategy, setStrategy] = useState(existingPosition?.strategy || recommendedStrategy || 'momentum');
    const [quantity, setQuantity] = useState(existingPosition?.quantity || '');

    // Risk Management States
    const [maxRisk, setMaxRisk] = useState(existingPosition?.maxRisk || 50); // USD 50 risk default
    const [stopLoss, setStopLoss] = useState(existingPosition?.stopLoss || '');
    const [targetPrice, setTargetPrice] = useState(existingPosition?.targetPrice || '');
    const [showRiskCalc, setShowRiskCalc] = useState(false);
    const [showSellModal, setShowSellModal] = useState(false);
    const [calcMode, setCalcMode] = useState('risk'); // 'risk' | 'capital'
    const [capitalAmount, setCapitalAmount] = useState(''); // Total capital to invest

    // Sell Modal States
    const [sellPrice, setSellPrice] = useState(currentPrice || '');
    const [sellQty, setSellQty] = useState(existingPosition?.quantity || '');
    const [tradeType, setTradeType] = useState('REAL');
    const [sellNotes, setSellNotes] = useState('');
    const [isSelling, setIsSelling] = useState(false);

    // Reset strategy if recommendedStrategy changes and no existing position
    useEffect(() => {
        if (!existingPosition && recommendedStrategy) {
            setStrategy(recommendedStrategy);
        }
    }, [recommendedStrategy, existingPosition]);

    // Sync entry price with current price if it's a new position and entry is currently empty/zero
    useEffect(() => {
        if (!existingPosition && currentPrice && (!entryPrice || parseFloat(entryPrice) === 0)) {
            setEntryPrice(currentPrice);
        }
    }, [currentPrice, existingPosition]);

    // Update suggested SL and Target when levels change or entryPrice changes
    useEffect(() => {
        if (!existingPosition) {
            const entry = parseFloat(entryPrice);
            // Priority 1: System's technical levels
            // Priority 2: Mathematical defaults (5% SL, 10% TP)

            // Map technicalLevels (which is plan.trade from buildTradePlan)
            const sysSL = technicalLevels?.stopLoss || technicalLevels?.stopPrice;
            const sysTP = technicalLevels?.tp1 || technicalLevels?.targetPrice || technicalLevels?.target1;

            if (sysSL) setStopLoss(parseFloat(sysSL).toFixed(3));
            else if (entry) setStopLoss((entry * 0.95).toFixed(3));

            if (sysTP) setTargetPrice(parseFloat(sysTP).toFixed(3));
            else if (entry) setTargetPrice((entry * 1.10).toFixed(3));
        }
    }, [entryPrice, existingPosition, technicalLevels]);

    const sizing = React.useMemo(() => {
        if (!entryPrice || !stopLoss || !maxRisk) return { suggestedLots: 0, potentialProfit: 0, totalInvestment: 0, rr: 0 };
        const entry = parseFloat(entryPrice);
        const sl = parseFloat(stopLoss);
        const tp = targetPrice ? parseFloat(targetPrice) : 0;

        if (entry <= sl) return { suggestedLots: 0, potentialProfit: 0, totalInvestment: 0, rr: 0 };

        const riskPerUnit = entry - sl;

        // Default to USD/Shares logic for this project
        const lotSize = 1;
        const actualUnits = maxRisk / riskPerUnit;

        const suggestedLots = actualUnits;

        const potentialProfit = tp > entry ? (tp - entry) * actualUnits : 0;
        const totalInvestment = entry * actualUnits;
        const rr = (tp - entry) / riskPerUnit;

        // Sweet Spot Calculation (Target RR 2.0)
        // (tp - entry) / (entry - sl) = 2
        // tp - entry = 2 * entry - 2 * sl
        // tp + 2 * sl = 3 * entry
        // entry = (tp + 2 * sl) / 3
        const sweetSpot = tp && sl ? (tp + (2 * sl)) / 3 : null;

        return {
            suggestedLots,
            potentialProfit,
            totalInvestment,
            rr: tp > entry ? rr.toFixed(2) : 0,
            sweetSpot: sweetSpot && sweetSpot < tp ? sweetSpot.toFixed(3) : null
        };
    }, [entryPrice, stopLoss, targetPrice, maxRisk]);

    // Capital-based sizing
    const capitalSizing = React.useMemo(() => {
        if (!entryPrice || !capitalAmount) return { shares: 0, potentialProfit: 0, rr: 0 };
        const entry = parseFloat(entryPrice);
        const capital = parseFloat(capitalAmount);
        const sl = stopLoss ? parseFloat(stopLoss) : 0;
        const tp = targetPrice ? parseFloat(targetPrice) : 0;
        if (entry <= 0 || capital <= 0) return { shares: 0, potentialProfit: 0, rr: 0 };

        const shares = capital / entry;
        const potentialProfit = tp > entry ? (tp - entry) * shares : 0;
        const riskPerUnit = sl > 0 ? entry - sl : 0;
        const rr = riskPerUnit > 0 && tp > entry ? ((tp - entry) / riskPerUnit).toFixed(2) : 0;

        return { shares, potentialProfit, rr };
    }, [entryPrice, capitalAmount, stopLoss, targetPrice]);

    const handleApplySizing = () => {
        if (calcMode === 'capital') {
            if (capitalSizing.shares > 0) {
                setQuantity(capitalSizing.shares.toFixed(4));
                setShowRiskCalc(false);
            }
        } else {
            if (sizing.suggestedLots > 0) {
                setQuantity(sizing.suggestedLots.toFixed(4));
                setShowRiskCalc(false);
            }
        }
    };

    const handleSave = () => {
        if (!entryPrice) return;
        onSave({
            entryPrice: parseFloat(entryPrice),
            strategy,
            quantity: quantity ? parseFloat(quantity) : 0,
            stopLoss: stopLoss ? parseFloat(stopLoss) : null,
            targetPrice: targetPrice ? parseFloat(targetPrice) : null,
            maxRisk: parseFloat(maxRisk),
            buyDate: existingPosition?.buyDate || new Date().toISOString()
        });
    };

    const handleSell = async () => {
        if (!sellPrice || !sellQty) return;
        setIsSelling(true);
        try {
            await onSell({
                sell_price: parseFloat(sellPrice),
                quantity: parseFloat(sellQty),
                trade_type: tradeType,
                notes: sellNotes
            });
            setShowSellModal(false);
            setSellNotes('');
        } catch (err) {
            alert(err.message || "Sell failed");
        } finally {
            setIsSelling(false);
        }
    };

    return (
        <div className="bg-surfaceHighlight/20 rounded-2xl p-6 border border-white/5 shadow-inner mt-4">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-500" /> Manage My Position
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowRiskCalc(!showRiskCalc)}
                        className={`p-1.5 rounded-lg transition-all ${showRiskCalc ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-500 hover:text-indigo-400'}`}
                        title="Risk Calculator"
                    >
                        <Calculator className="w-4 h-4" />
                    </button>
                    {existingPosition && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
                            Aktif
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {/* Trade Plan Summary (Visible when calc is closed) */}
                {!showRiskCalc && (stopLoss || targetPrice || technicalLevels?.trailingStop) && (
                    <div className="flex flex-col gap-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-3">
                            <div className="text-[10px] font-black text-indigo-400/60 uppercase tracking-widest whitespace-nowrap">My Plan:</div>
                            <div className="flex items-center gap-4 text-[11px] font-bold">
                                {stopLoss && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-500 uppercase text-[9px]">SL</span>
                                        <span className="text-red-400">USD {stopLoss}</span>
                                    </div>
                                )}
                                {targetPrice && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-500 uppercase text-[9px]">TP</span>
                                        <span className="text-emerald-400">USD {targetPrice}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Proactive Trailing Stop Suggestion for Active Positions */}
                        {existingPosition && technicalLevels?.trailingStop && parseFloat(currentPrice) > parseFloat(existingPosition.entryPrice) && (
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <span className={`text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 ${parseFloat(technicalLevels.trailingStop) >= parseFloat(existingPosition.entryPrice) ? 'text-emerald-400' : 'text-indigo-300'}`}>
                                    <ShieldAlert className="w-2.5 h-2.5" />
                                    {parseFloat(technicalLevels.trailingStop) >= parseFloat(existingPosition.entryPrice) ? 'Profit Protection' : 'Capital Protection'}
                                </span>
                                <button
                                    onClick={() => setStopLoss(parseFloat(technicalLevels.trailingStop).toFixed(3))}
                                    className={`text-[10px] font-black text-white px-2 py-0.5 rounded border transition-all ${parseFloat(technicalLevels.trailingStop) >= parseFloat(existingPosition.entryPrice) ? 'bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/40' : 'bg-indigo-500/20 border-indigo-500/30 hover:bg-indigo-500/40'}`}
                                >
                                    SET TO USD {parseFloat(technicalLevels.trailingStop).toFixed(3)}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Risk Calculator Expanded */}
                {showRiskCalc && (
                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mb-4 animate-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider">Risk:Reward Calculator</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Mode Toggle */}
                                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setCalcMode('risk')}
                                        className={`text-[9px] font-black uppercase px-2 py-1 rounded-md transition-all ${calcMode === 'risk' ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-white'}`}
                                    >Risk</button>
                                    <button
                                        type="button"
                                        onClick={() => setCalcMode('capital')}
                                        className={`text-[9px] font-black uppercase px-2 py-1 rounded-md transition-all ${calcMode === 'capital' ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:text-white'}`}
                                    >Modal</button>
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${(calcMode === 'risk' ? sizing.rr : capitalSizing.rr) >= 2 ? 'bg-emerald-500/20 text-emerald-400' : ((calcMode === 'risk' ? sizing.rr : capitalSizing.rr) >= 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400')}`}>
                                    RR {calcMode === 'risk' ? sizing.rr : capitalSizing.rr}
                                </div>
                            </div>
                        </div>
                        {/* Risk Mode */}
                        {calcMode === 'risk' && (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-indigo-300/60 uppercase font-bold ml-1">Max Risk (USD)</label>
                                    <input
                                        type="number"
                                        value={maxRisk}
                                        onChange={(e) => setMaxRisk(e.target.value)}
                                        className="w-full bg-background/40 border border-indigo-500/20 rounded-lg px-3 py-2 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-indigo-300/60 uppercase font-bold ml-1">Stop Loss Price</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={stopLoss}
                                        onChange={(e) => setStopLoss(e.target.value)}
                                        className="w-full bg-background/40 border border-indigo-500/20 rounded-lg px-3 py-2 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2 lg:col-span-1 text-indigo-400">
                                    <label className="text-[9px] text-indigo-400/60 uppercase font-bold ml-1">Target Price (TP)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={targetPrice}
                                        onChange={(e) => setTargetPrice(e.target.value)}
                                        className="w-full bg-background/60 border border-indigo-500/40 rounded-lg px-3 py-2 text-xs text-white font-black"
                                        placeholder="Target Price"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Capital Mode */}
                        {calcMode === 'capital' && (
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-emerald-300/70 uppercase font-bold ml-1">💰 Modal (USD)</label>
                                    <input
                                        type="number"
                                        value={capitalAmount}
                                        onChange={(e) => setCapitalAmount(e.target.value)}
                                        className="w-full bg-background/40 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-white font-normal"
                                        placeholder="e.g. 1000"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-indigo-300/60 uppercase font-bold ml-1">Stop Loss Price</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={stopLoss}
                                        onChange={(e) => setStopLoss(e.target.value)}
                                        className="w-full bg-background/40 border border-indigo-500/20 rounded-lg px-3 py-2 text-xs text-white"
                                    />
                                </div>
                                <div className="space-y-1.5 text-indigo-400">
                                    <label className="text-[9px] text-indigo-400/60 uppercase font-bold ml-1">Target Price (TP)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={targetPrice}
                                        onChange={(e) => setTargetPrice(e.target.value)}
                                        className="w-full bg-background/60 border border-indigo-500/40 rounded-lg px-3 py-2 text-xs text-white font-black"
                                        placeholder="Target Price"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between bg-indigo-500/10 rounded-lg px-4 py-4 border border-indigo-500/10">
                            <div className="flex gap-6">
                                <div>
                                    <div className="text-[10px] text-indigo-300/70 font-bold uppercase">Suggested Shares</div>
                                    {calcMode === 'risk' ? (
                                        <>
                                            <div className="text-xl font-black text-white">{sizing.suggestedLots % 1 === 0 ? sizing.suggestedLots : sizing.suggestedLots.toFixed(4)} <span className="text-[10px] font-normal text-indigo-300/50 uppercase">Shares</span></div>
                                            <div className="text-[9px] text-indigo-300/40 font-bold mt-1">
                                                Modal: USD {sizing.totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-xl font-black text-emerald-400">{capitalSizing.shares > 0 ? capitalSizing.shares.toFixed(4) : '—'} <span className="text-[10px] font-normal text-emerald-300/50 uppercase">Shares</span></div>
                                            <div className="text-[9px] text-emerald-300/50 font-bold mt-1">
                                                Modal: USD {capitalAmount ? parseFloat(capitalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="h-10 w-px bg-white/5"></div>
                                <div>
                                    <div className="text-[10px] text-emerald-400/70 font-bold uppercase">Potential Profit</div>
                                    <div className="text-xl font-black text-emerald-400">
                                        <span className="text-xs mr-1 opacity-60">USD</span>
                                        {calcMode === 'risk' ? sizing.potentialProfit.toFixed(1) : capitalSizing.potentialProfit.toFixed(1)}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleApplySizing}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-4 py-2.5 rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                            >
                                USE SIZING
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Entry Price */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] text-gray-500 uppercase font-black tracking-tighter flex items-center gap-1.5 ml-1">
                            <DollarSign className="w-3 h-3 text-gray-600" /> Entry Price (USD)
                        </label>
                        <div className="relative group">
                            <input
                                type="number"
                                step="0.001"
                                value={entryPrice}
                                onChange={(e) => setEntryPrice(e.target.value)}
                                className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all placeholder:text-gray-700"
                                placeholder="0.000"
                            />
                            {sizing.sweetSpot && (
                                <button
                                    onClick={() => setEntryPrice(sizing.sweetSpot)}
                                    className="mt-1.5 ml-1 text-[9px] font-bold text-emerald-400/60 hover:text-emerald-400 transition-colors uppercase tracking-widest flex items-center gap-1 group/ss"
                                >
                                    <Target className="w-2.5 h-2.5 transition-transform group-hover/ss:scale-110" />
                                    QUE PRICE (RR 2.0): <span className="text-white">USD {sizing.sweetSpot}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Strategy */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] text-gray-500 uppercase font-black tracking-tighter flex items-center gap-1.5 ml-1">
                            <Target className="w-3 h-3 text-gray-600" /> Strategy
                        </label>
                        <select
                            value={strategy}
                            onChange={(e) => setStrategy(e.target.value)}
                            className={`w-full bg-background/50 border rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all appearance-none cursor-pointer ${!existingPosition ? 'border-indigo-500/30 ring-1 ring-indigo-500/10' : 'border-white/10'}`}
                        >
                            <option value="momentum">🚀 Momentum {recommendedStrategy === 'momentum' && !existingPosition ? '⭐' : ''}</option>
                            <option value="rebound">📈 Rebound {recommendedStrategy === 'rebound' && !existingPosition ? '⭐' : ''}</option>
                        </select>
                        {!existingPosition && recommendedStrategy && (
                            <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-1 ml-1 animate-pulse">
                                Recommended for this stock
                            </div>
                        )}
                    </div>

                    {/* Quantity */}
                    <div className="flex flex-col gap-2 col-span-2 lg:col-span-1">
                        <label className="text-[9px] text-gray-500 uppercase font-black tracking-tighter flex items-center gap-1.5 ml-1">
                            <Hash className="w-3 h-3 text-gray-600" /> Quantity (Shares)
                        </label>
                        <input
                            type="number"
                            step="any"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all placeholder:text-gray-700"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={handleSave}
                        className={`
                            flex-1 flex items-center justify-center gap-3 font-black py-4 rounded-xl transition-all text-xs uppercase tracking-widest
                            ${existingPosition
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0'}
                        `}
                    >
                        <Save className="w-4 h-4" /> {existingPosition ? 'Update' : 'Record My Buy'}
                    </button>
                    {existingPosition && (
                        <>
                            <button
                                onClick={() => {
                                    setSellPrice(currentPrice);
                                    setSellQty(existingPosition.quantity);
                                    setShowSellModal(true);
                                }}
                                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-black py-4 rounded-xl transition-all text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20"
                            >
                                <TrendingUp className="w-4 h-4" /> SELL
                            </button>
                            <button
                                onClick={() => onRemove(ticker)}
                                className="p-4 bg-red-400/5 hover:bg-red-400/10 text-red-500 border border-red-500/10 rounded-xl transition-all group"
                                title="Remove Position"
                            >
                                <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Sell Modal Overlay */}
            {showSellModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#151518] border border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-500"></div>

                        <h4 className="text-xl font-black text-white uppercase italic tracking-tighter mb-6 flex items-center gap-3">
                            <TrendingUp className="w-6 h-6 text-orange-500" /> Sell Position
                        </h4>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Trade Category</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setTradeType('REAL')}
                                        className={`py-3 rounded-xl text-xs font-black transition-all ${tradeType === 'REAL' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        REAL TRADE
                                    </button>
                                    <button
                                        onClick={() => setTradeType('PAPER')}
                                        className={`py-3 rounded-xl text-xs font-black transition-all ${tradeType === 'PAPER' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                    >
                                        PAPER TRADE
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Sell Price (USD)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={sellPrice}
                                        onChange={(e) => setSellPrice(e.target.value)}
                                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Quantity</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={sellQty}
                                        onChange={(e) => setSellQty(e.target.value)}
                                        className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all font-bold"
                                        max={existingPosition?.quantity || 0}
                                    />
                                    <p className="text-[9px] text-gray-500 font-bold uppercase ml-1">Max: {existingPosition?.quantity || 0}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Notes (Optional)</label>
                                <textarea
                                    value={sellNotes}
                                    onChange={(e) => setSellNotes(e.target.value)}
                                    placeholder="Kenapa jual? (e.g. Hit TP, Break Support)"
                                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all min-h-[80px] resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowSellModal(false)}
                                className="flex-1 py-4 rounded-xl text-xs font-black text-gray-400 uppercase tracking-widest hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSell}
                                disabled={isSelling || !sellPrice || !sellQty}
                                className="flex-[2] bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 transition-all active:scale-95"
                            >
                                {isSelling ? 'PROCESSING...' : (existingPosition && parseFloat(sellQty) < existingPosition.quantity ? 'CONFIRM PARTIAL SELL' : 'CONFIRM FULL SELL')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
