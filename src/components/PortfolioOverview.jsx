import React from 'react';
import { Briefcase, TrendingUp, TrendingDown } from 'lucide-react';

export function PortfolioOverview({
    totalPositions,
    avgPL,
    greenPositions,
    portfolioList,
    onSelectStock
}) {
    if (totalPositions === 0) return null;

    return (
        <div className="max-w-7xl mx-auto mb-10 animate-in slide-in-from-top duration-500">
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2rem] p-6 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden group">
                {/* Background Glow */}
                <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[100px] opacity-20 pointer-events-none transition-colors duration-1000 ${avgPL >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

                {/* Left Section: Count */}
                <div className="flex items-center gap-5 pr-8 md:border-r border-white/10 shrink-0">
                    <div className="p-4 bg-white/5 rounded-[1.5rem] border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <Briefcase className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-1">Portfolio Saya</div>
                        <div className="text-2xl font-black text-white tracking-tighter">{totalPositions} Saham Pegangan</div>
                    </div>
                </div>

                {/* Middle Section: Stats */}
                <div className="flex items-center gap-12 flex-1">
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-2">Purata P/L</div>
                        <div className={`text-3xl font-black flex items-center gap-2 tracking-tighter ${avgPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {avgPL >= 0 ?
                                <TrendingUp className="w-6 h-6 stroke-[3]" /> :
                                <TrendingDown className="w-6 h-6 stroke-[3]" />
                            }
                            {Number(avgPL).toFixed(2)}%
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-2">Status</div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-xs font-black text-emerald-400">{greenPositions} Untung</span>
                            </div>
                            <span className="text-gray-700 font-bold">/</span>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 rounded-full border border-red-500/20">
                                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                                <span className="text-xs font-black text-red-400">{totalPositions - greenPositions} Rugi</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Section: Individual Chips */}
                <div className="flex items-center justify-end gap-3 flex-wrap max-w-md">
                    {portfolioList.map(pos => (
                        <button
                            key={pos.ticker}
                            onClick={() => onSelectStock(pos.fullData)}
                            className={`
                                flex flex-col items-center justify-center min-w-[80px] px-4 py-2 rounded-2xl border text-[10px] font-black transition-all hover:scale-105 active:scale-95 group/chip
                                ${pos.pl >= 0
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40'
                                    : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 hover:border-red-500/40'}
                            `}
                        >
                            <span className="text-xs uppercase tracking-tighter mb-0.5 group-hover/chip:text-white transition-colors">{pos.ticker.split('.')[0]}</span>
                            <span className={`text-[10px] ${pos.plPercent >= 0 ? 'text-emerald-500' : 'text-red-500'} font-bold`}>
                                {pos.plPercent >= 0 ? '+' : ''}{Number(pos.plPercent).toFixed(1)}%
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
