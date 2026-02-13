import React, { useState, useEffect } from 'react';
import { Save, Trash2, TrendingUp, BarChart2, DollarSign, Target, Hash, ShieldAlert, Calculator } from 'lucide-react';

export function PositionManager({ ticker, currentPrice, existingPosition, recommendedStrategy, onSave, onRemove }) {
    const [entryPrice, setEntryPrice] = useState(existingPosition?.entryPrice || currentPrice || '');
    const [strategy, setStrategy] = useState(existingPosition?.strategy || recommendedStrategy || 'momentum');
    const [quantity, setQuantity] = useState(existingPosition?.quantity || '');

    // Risk Management States
    const [maxRisk, setMaxRisk] = useState(existingPosition?.maxRisk || 50); // RM 50 risk default
    const [stopLoss, setStopLoss] = useState(existingPosition?.stopLoss || '');
    const [targetPrice, setTargetPrice] = useState(existingPosition?.targetPrice || '');
    const [showRiskCalc, setShowRiskCalc] = useState(false);

    // Reset strategy if recommendedStrategy changes and no existing position
    useEffect(() => {
        if (!existingPosition && recommendedStrategy) {
            setStrategy(recommendedStrategy);
        }
    }, [recommendedStrategy, existingPosition]);

    // Update suggested SL and Target when entryPrice changes (only for new positions)
    useEffect(() => {
        if (entryPrice && !existingPosition) {
            if (!stopLoss) setStopLoss((parseFloat(entryPrice) * 0.95).toFixed(3)); // Default 5% SL
            if (!targetPrice) setTargetPrice((parseFloat(entryPrice) * 1.10).toFixed(3)); // Default 10% TP
        }
    }, [entryPrice, existingPosition]);

    const sizing = React.useMemo(() => {
        if (!entryPrice || !stopLoss || !maxRisk) return { suggestedLots: 0, potentialProfit: 0, totalInvestment: 0, rr: 0 };
        const entry = parseFloat(entryPrice);
        const sl = parseFloat(stopLoss);
        const tp = targetPrice ? parseFloat(targetPrice) : 0;

        if (entry <= sl) return { suggestedLots: 0, potentialProfit: 0, totalInvestment: 0, rr: 0 };

        const riskPerUnit = entry - sl;
        const totalUnits = Math.floor(maxRisk / riskPerUnit);
        const suggestedLots = Math.floor(totalUnits / 100);
        const actualUnits = suggestedLots * 100;

        const potentialProfit = tp > entry ? (tp - entry) * actualUnits : 0;
        const totalInvestment = entry * actualUnits;
        const rr = (tp - entry) / riskPerUnit;

        return {
            suggestedLots,
            potentialProfit,
            totalInvestment,
            rr: tp > entry ? rr.toFixed(2) : 0
        };
    }, [entryPrice, stopLoss, targetPrice, maxRisk]);

    const handleApplySizing = () => {
        if (sizing.suggestedLots > 0) {
            setQuantity(sizing.suggestedLots * 100);
            setShowRiskCalc(false);
        }
    };

    const handleSave = () => {
        if (!entryPrice) return;
        onSave({
            entryPrice: parseFloat(entryPrice),
            strategy,
            quantity: quantity ? parseInt(quantity) : 0,
            stopLoss: stopLoss ? parseFloat(stopLoss) : null,
            targetPrice: targetPrice ? parseFloat(targetPrice) : null,
            maxRisk: parseFloat(maxRisk),
            buyDate: existingPosition?.buyDate || new Date().toISOString()
        });
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
                {!showRiskCalc && (stopLoss || targetPrice) && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl animate-in fade-in slide-in-from-top-1">
                        <div className="text-[10px] font-black text-indigo-400/60 uppercase tracking-widest whitespace-nowrap">My Plan:</div>
                        <div className="flex items-center gap-4 text-[11px] font-bold">
                            {stopLoss && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-500 uppercase text-[9px]">SL</span>
                                    <span className="text-red-400">RM {stopLoss}</span>
                                </div>
                            )}
                            {targetPrice && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-500 uppercase text-[9px]">TP</span>
                                    <span className="text-emerald-400">RM {targetPrice}</span>
                                </div>
                            )}
                            {sizing.rr > 0 && (
                                <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${sizing.rr >= 2 ? 'bg-emerald-500/20 text-emerald-400' : (sizing.rr >= 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-500')}`}>
                                    RR {sizing.rr}
                                </div>
                            )}
                        </div>
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
                            <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${sizing.rr >= 2 ? 'bg-emerald-500/20 text-emerald-400' : (sizing.rr >= 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400')}`}>
                                RR {sizing.rr}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] text-indigo-300/60 uppercase font-bold ml-1">Max Risk (RM)</label>
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
                        <div className="flex items-center justify-between bg-indigo-500/10 rounded-lg px-4 py-4 border border-indigo-500/10">
                            <div className="flex gap-6">
                                <div>
                                    <div className="text-[10px] text-indigo-300/70 font-bold uppercase">Suggested Lots</div>
                                    <div className="text-xl font-black text-white">{sizing.suggestedLots} <span className="text-[10px] font-normal text-indigo-300/50 uppercase">Lots</span></div>
                                    <div className="text-[9px] text-indigo-300/40 font-bold mt-1">
                                        Modal: RM {sizing.totalInvestment.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-white/5"></div>
                                <div>
                                    <div className="text-[10px] text-emerald-400/70 font-bold uppercase">Potential Profit</div>
                                    <div className="text-xl font-black text-emerald-400">
                                        <span className="text-xs mr-1 opacity-60">RM</span>
                                        {sizing.potentialProfit.toFixed(1)}
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
                            <DollarSign className="w-3 h-3 text-gray-600" /> Entry Price (RM)
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
                            <Hash className="w-3 h-3 text-gray-600" /> Quantity
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all placeholder:text-gray-700"
                            placeholder="Unit count"
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
                        <Save className="w-4 h-4" /> {existingPosition ? 'Update Position' : 'Record My Buy'}
                    </button>
                    {existingPosition && (
                        <button
                            onClick={() => onRemove(ticker)}
                            className="p-4 bg-red-400/5 hover:bg-red-400/10 text-red-500 border border-red-500/10 rounded-xl transition-all group"
                            title="Remove Position"
                        >
                            <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
