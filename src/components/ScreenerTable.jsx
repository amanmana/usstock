import React, { useState } from 'react';
import { Eye, Heart, ExternalLink, Bell, Activity } from 'lucide-react';
import { format } from 'date-fns';

export function ScreenerTable({ data, onView, onToggleFavourite, favouriteTickers = [], favouriteDetails = {}, activeTab = 'rebound', positions = {} }) {
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

    return (
        <div className="overflow-x-auto rounded-xl border border-border shadow-2xl bg-surface">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-surfaceHighlight border-b border-border text-xs uppercase tracking-wider text-gray-400 font-medium">
                    <tr>
                        <th className="p-4 pl-6 w-10"></th>
                        <th className="p-4">Ticker / Company</th>
                        <th className="p-4 text-center">Score</th>
                        <th className="p-4 text-center">Strategy / Action</th>
                        <th className="p-4 text-right">Close (USD)</th>
                        <th className="p-4 text-center">DD% / RSI</th>
                        <th className="p-4">Signals</th>
                        <th className="p-4 pr-6 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                    {data.map((stock) => {
                        if (!stock) return null;
                        const isFavourited = favouriteTickers.includes(stock.ticker);
                        const isStockOwnedByUser = !!positions[stock.ticker];

                        // Recommendation Logic
                        const isHybrid = activeTab === 'hybrid';
                        const momentumScore = parseFloat(stock.momentumScore) || 0;
                        const reboundScore = parseFloat(stock.score) || 0;

                        // If hybrid, use whichever is higher
                        const isMomentum = isHybrid ? (momentumScore > reboundScore) : (activeTab === 'momentum');
                        const scoreNum = isMomentum ? momentumScore : reboundScore;

                        let recommendation = "NEUTRAL";
                        let colorClass = "text-gray-400 bg-gray-500/10 border-gray-500/20";
                        let conviction = Math.round(scoreNum * 10);

                        if (stock.stats?.rsi14 >= 75) {
                            recommendation = isMomentum ? "OVEREXTENDED" : "SELL/PROFIT";
                            colorClass = "text-red-400 bg-red-500/10 border-red-500/50 shadow-[0_0_10px_rgba(248,113,113,0.1)]";
                        } else if (scoreNum >= 8.5) {
                            recommendation = isMomentum ? "RIDE TREND" : "STRONG BUY";
                            colorClass = "text-accent bg-accent/10 border-accent/50 shadow-[0_0_10px_rgba(251,191,36,0.1)]";
                        } else if (scoreNum >= 7.0) {
                            recommendation = isMomentum ? "FOLLOW TREND" : "BUY";
                            colorClass = "text-primary bg-primary/10 border-primary/50 shadow-[0_0_10px_rgba(59,130,246,0.15)]";
                        } else if (scoreNum >= 5.0) {
                            recommendation = isMomentum ? "WATCH TREND" : "WATCHLIST";
                            colorClass = isMomentum ? "text-orange-400 bg-orange-500/10 border-orange-500/20" : "text-blue-300 bg-blue-500/10 border-blue-500/20";
                        }

                        // Adjust conviction based on signals
                        const signals = stock.signals || [];
                        if (signals.includes('REBOUND')) conviction += 5;
                        if (signals.includes('PULLBACK')) conviction += 2;
                        if (signals.includes('MOMENTUM')) conviction += 10;
                        conviction = Math.min(99, Math.max(10, conviction));

                        return (
                            <tr key={stock.ticker} className="group hover:bg-white/5 transition-colors duration-150">
                                <td className="p-4 pl-6">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleFavourite(stock.ticker);
                                        }}
                                        className="p-1 hover:scale-125 transition-transform"
                                        title={isFavourited ? "Remove from favourites" : "Add to favourites"}
                                    >
                                        <Heart className={`w-5 h-5 transition-colors ${isFavourited ? 'fill-red-500 text-red-500' : 'text-gray-600 hover:text-red-400'}`} />
                                    </button>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-white text-base group-hover:text-primary transition-colors">
                                            {stock.company || 'Unknown'}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded uppercase">{stock.fullName || stock.company || '-'}</span>
                                            <span className="text-[10px] text-gray-500 font-mono font-bold tracking-wider">{stock.ticker}</span>
                                            {isStockOwnedByUser && (
                                                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-black animate-pulse">OWNED</span>
                                            )}
                                            {favouriteDetails[stock.ticker]?.alert_enabled && (
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-[9px] font-black text-blue-400 animate-pulse">
                                                    <Bell className="w-2.5 h-2.5 fill-current" />
                                                    ALERT
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className={`
                                            inline-flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm
                                            ${scoreNum >= 8.5 ? (isMomentum ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-accent/10 text-accent border border-accent/20') :
                                                scoreNum >= 7.0 ? 'bg-primary/10 text-primary border border-primary/20' :
                                                    'bg-gray-700/50 text-gray-400'}
                                        `}>
                                            {scoreNum.toFixed(1)}
                                        </div>
                                        {isHybrid && (
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${isMomentum ? 'bg-orange-500/10 text-orange-500 border-orange-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                                                {isMomentum ? 'Momentum' : 'Rebound'}
                                            </span>
                                        )}
                                    </div>
                                </td>

                                <td className="p-4 text-center">
                                    <div className={`inline-flex flex-col items-center px-3 py-1 rounded-lg border font-bold text-[11px] tracking-tight ${colorClass}`}>
                                        <span className="whitespace-nowrap">{recommendation}</span>
                                        <span className="text-[9px] opacity-70 font-mono">{conviction}% Confidence</span>
                                    </div>
                                </td>

                                <td className="p-4 text-right">
                                    <div className="flex flex-col items-end">
                                        <div className={`font-mono text-base font-bold transition-all duration-500 ${stock.isLivePrice ? 'text-primary' : 'text-gray-200'}`}>
                                            USD {stock.close ? stock.close.toFixed(3) : '-'}
                                        </div>
                                        <div className="mt-0.5">
                                            {stock.isLivePrice ? (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-[9px] font-black text-primary animate-pulse uppercase tracking-widest">
                                                    <Activity className="w-2.5 h-2.5" />
                                                    LIVE Price
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">
                                                    {(() => {
                                                        if (!stock.date) return '-';
                                                        try {
                                                            return format(new Date(stock.date), 'dd MMM');
                                                        } catch (e) {
                                                            return '-';
                                                        }
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className={`text-xs font-mono px-2 py-0.5 rounded ${stock.stats?.dropdownPercent > 20 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                                            DD: -{stock.stats?.dropdownPercent || 0}%
                                        </div>
                                        <div className={`text-xs font-mono font-medium ${stock.stats?.rsi14 >= 70 ? 'text-red-400' :
                                            stock.stats?.rsi14 <= 30 ? 'text-green-400' : 'text-blue-400'
                                            }`}>
                                            RSI: {stock.stats?.rsi14?.toFixed(0) || '-'}
                                        </div>
                                    </div>
                                </td>

                                <td className="p-4">
                                    <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                        {signals.map(sig => (
                                            <span key={sig} className={`
                                                px-2 py-0.5 text-[10px] rounded border font-semibold tracking-wide
                                                ${sig === 'UPTREND' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                                                ${sig === 'PULLBACK' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : ''}
                                                ${sig === 'REBOUND' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                                                ${sig === 'MOMENTUM' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
                                                ${sig === 'MINERVINI-SETUP' ? 'bg-amber-500/20 text-accent border-accent/30 font-black' : ''}
                                                ${sig === 'MA-SUPPORT' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : ''}
                                            `}>
                                                {sig}
                                            </span>
                                        ))}
                                        {signals.length === 0 && (
                                            <span className="text-gray-600 text-xs">-</span>
                                        )}
                                    </div>
                                </td>

                                <td className="p-4 pr-6 text-right">
                                    <button
                                        onClick={() => onView(stock)}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 bg-surfaceHighlight hover:bg-primary hover:text-white rounded-md transition-all shadow-sm border border-border hover:border-primary"
                                    >
                                        <Eye className="w-4 h-4" /> View
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
