import React, { useState } from 'react';
import { Eye, Heart, ExternalLink, Bell, Activity, TrendingUp, TrendingDown, Target, Clock, AlertOctagon, CheckCircle, Zap } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export function ScreenerTable({
    data,
    onView,
    onToggleFavourite,
    favouriteTickers = [],
    favouriteDetails = {},
    activeTab = 'rebound',
    positions = {},
    market = 'USD',
    variant = 'standard', // 'standard' or 'monitor'
    loading = false
}) {
    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-border dashed rounded-xl bg-surface/50">
                <div className="p-4 bg-surfaceHighlight rounded-full mb-4">
                    <Eye className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-white">Tiada keputusan dijumpai</h3>
                <p className="text-gray-400 mt-1 max-w-sm">
                    Cuba tukar penapis (filter) atau klik butang selari (sync) data terbaru.
                </p>
            </div>
        );
    }

    const isMonitor = variant === 'monitor';
    const currency = (market === 'MYR' || market === 'KLSE' || data[0]?.market === 'MYR' || data[0]?.market === 'KLSE') ? 'RM' : 'USD';

    return (
        <div className="overflow-x-auto rounded-xl border border-border shadow-2xl bg-surface">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surfaceHighlight border-b border-border text-xs uppercase tracking-wider text-gray-400 font-medium">
                    <tr>
                        <th className="p-4 pl-6 w-10"></th>
                        <th className="p-4">Ticker / Company</th>
                        {isMonitor && <th className="p-4 text-center">Action</th>}
                        {!isMonitor && <th className="p-4 text-center">Score</th>}
                        <th className="p-4 text-center">{isMonitor ? 'Performance' : 'Strategy'}</th>
                        <th className="p-4 text-right">Price / DD%</th>
                        {isMonitor && <th className="p-4 text-center">Targets / SL</th>}
                        {!isMonitor && <th className="p-4 text-center">DD% / RSI</th>}
                        <th className="p-4">Alignment / Signals</th>
                        <th className="p-4 pr-6 text-right">Details</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                    {data.map((stock) => {
                        if (!stock) return null;
                        const isFavourited = favouriteTickers.includes(stock.ticker);
                        const pos = positions[stock.ticker];
                        const isOwned = !!pos;

                        // Logic similar to buildTradePlan for "Action"
                        const confirmedCount = stock.scoreMTF || (stock.signals ? stock.signals.filter(s => ['UPTREND', 'MOMENTUM', 'REBOUND'].includes(s)).length : 0);
                        const rawScore = (activeTab === 'momentum') ? (stock.momentumScore || 0) :
                            (activeTab === 'hybrid') ? Math.max(parseFloat(stock.score || 0), parseFloat(stock.momentumScore || 0)) :
                                (stock.score || 0);
                        const scoreNum = parseFloat(rawScore) || 0;
                        const currentPrice = parseFloat(stock.close) || 0;

                        // Identify Verdict for Monitor
                        let verdict = "NEUTRAL";
                        let vColor = "text-gray-500 bg-gray-500/10 border-gray-500/20";

                        if (isOwned) {
                            const sl = parseFloat(pos.stopLoss);
                            const tp = parseFloat(pos.targetPrice || (pos.entryPrice * 1.15));

                            if (currentPrice <= sl) {
                                verdict = "EXIT (SL)";
                                vColor = "text-red-400 bg-red-500/10 border-red-500/30 animate-pulse";
                            } else if (currentPrice >= tp) {
                                verdict = "EXIT (TP)";
                                vColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 animate-pulse";
                            } else {
                                verdict = "HOLDING";
                                vColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
                            }
                        } else {
                            // Watchlist Logic (Synchronized with buildTradePlan)
                            const isHighConviction = scoreNum >= 8.5 && confirmedCount >= 1;
                            const isMTFConfirmed = confirmedCount >= 2;

                            if (isMTFConfirmed || isHighConviction) {
                                verdict = "GO";
                                vColor = "text-emerald-400 bg-emerald-500/20 border-emerald-500/40 shadow-[0_0_15px_rgba(34,197,94,0.15)] animate-bounce-subtle";
                            } else if (confirmedCount >= 1 || scoreNum >= 7.0) {
                                verdict = "WAIT";
                                vColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
                            }
                        }

                        // PL% Calculation
                        const plPercent = isOwned ? ((currentPrice - pos.entryPrice) / pos.entryPrice * 100) : null;
                        const daysHeld = isOwned && pos.buyDate ? differenceInDays(new Date(), new Date(pos.buyDate)) : null;

                        return (
                            <tr key={stock.ticker} className={`group hover:bg-white/5 transition-all duration-150 ${isOwned ? 'bg-emerald-500/5' : ''} ${loading ? 'animate-pulse opacity-70 cursor-wait relative after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:animate-scan' : ''}`}>
                                <td className="p-4 pl-6">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleFavourite(stock.ticker);
                                        }}
                                        className="p-1 hover:scale-125 transition-transform"
                                    >
                                        <Heart className={`w-5 h-5 transition-colors ${isFavourited ? 'fill-red-500 text-red-500' : 'text-gray-600 hover:text-red-400'}`} />
                                    </button>
                                </td>

                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-base group-hover:text-primary transition-colors">
                                                {stock.company || 'Unknown'}
                                            </span>
                                            {isOwned && <span className="text-[8px] bg-emerald-500 text-black px-1.5 py-0.5 rounded-full font-black tracking-widest">OWNED</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-500 font-mono font-bold tracking-wider">{stock.ticker}</span>
                                            {isOwned && (
                                                <span className="text-[9px] text-emerald-500/70 font-bold uppercase tracking-tight">
                                                    • {stock.ticker.endsWith('.KL') ? `${(pos.quantity / 100).toLocaleString()} Lots` : `${pos.quantity.toLocaleString()} Units`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                {isMonitor && (
                                    <td className="p-4 text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-[10px] tracking-widest uppercase ${vColor}`}>
                                            {verdict.includes('EXIT') ? <AlertOctagon className="w-3 h-3" /> : (verdict === 'GO' ? <Zap className="w-3 h-3 fill-current" /> : null)}
                                            {verdict}
                                        </div>
                                    </td>
                                )}

                                {!isMonitor && (
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`
                                                w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border transition-all duration-500
                                                ${stock.isLivePrice
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                                    : 'bg-white/5 text-white border-white/5'}
                                            `}>
                                                {scoreNum.toFixed(1)}
                                            </div>
                                            {stock.isLivePrice && (
                                                <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">LATEST</span>
                                            )}
                                        </div>
                                    </td>
                                )}

                                <td className="p-4 text-center">
                                    {isOwned ? (
                                        <div className="flex flex-col items-center">
                                            <span className={`text-sm font-black ${plPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                                            </span>
                                            <div className="flex items-center gap-1 opacity-50">
                                                <Clock className="w-2.5 h-2.5" />
                                                <span className="text-[9px] font-bold">{daysHeld}D HELD</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                {activeTab === 'momentum' ? 'Momentum' : 'Rebound'}
                                            </span>
                                            <div className="h-1 w-8 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${scoreNum * 10}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                </td>

                                <td className="p-4 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-base font-black text-white">{currency} {currentPrice.toFixed(3)}</span>
                                        <span className={`text-[10px] font-bold ${stock.stats?.dropdownPercent > 10 ? 'text-red-400/70' : 'text-gray-500'}`}>
                                            DD: -{stock.stats?.dropdownPercent || 0}%
                                        </span>
                                    </div>
                                </td>

                                {isMonitor && (
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <Target className="w-3 h-3 text-emerald-500/50" />
                                                <span className="text-[11px] font-bold text-emerald-500/50">
                                                    {isOwned ? (pos.targetPrice?.toFixed(3) || '-') : (stock.levels?.target1?.toFixed(3) || '-')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-40">
                                                <AlertOctagon className="w-3 h-3 text-red-500" />
                                                <span className="text-[10px] font-bold text-white">
                                                    {isOwned ? (pos.stopLoss?.toFixed(3) || '-') : (stock.levels?.stopPrice?.toFixed(3) || '-')}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                )}

                                {!isMonitor && (
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-mono text-blue-400">RSI: {stock.stats?.rsi14?.toFixed(0) || '-'}</span>
                                        </div>
                                    </td>
                                )}

                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        {/* Alignment Dots */}
                                        <div className="flex gap-1">
                                            {[1, 2, 3].map(i => (
                                                <div
                                                    key={i}
                                                    className={`w-1.5 h-1.5 rounded-full ${i <= confirmedCount ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/10'}`}
                                                    title={`${confirmedCount}/3 Aligned`}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {(stock.signals || []).slice(0, 2).map(sig => (
                                                <span key={sig} className="px-1.5 py-0.5 bg-white/5 border border-white/5 rounded text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
                                                    {sig}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4 pr-6 text-right">
                                    <button
                                        onClick={() => onView(stock)}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-gray-400 bg-white/5 hover:bg-white text-black rounded-xl transition-all border border-white/5 hover:border-white shadow-xl"
                                    >
                                        <Eye className="w-3.5 h-3.5" /> View
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
