import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock, AlertCircle, CheckCircle2, ShoppingCart, Info, ArrowUpRight, ChevronRight, Star } from 'lucide-react';
import BTSTModal from '../components/BTSTModal';

const BTST = () => {
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStock, setSelectedStock] = useState(null);
    const [ownedTickers, setOwnedTickers] = useState(new Set());
    const [isScanning, setIsScanning] = useState(false);
    const [lastAutoUpdate, setLastAutoUpdate] = useState(null);
    const [nextUpdateIn, setNextUpdateIn] = useState(null);

    useEffect(() => {
        fetchLatestBTST();
        fetchOwnedPositions();

        // Timer for countdown visualization
        const timerInterval = setInterval(() => {
            const now = new Date();
            const hour = now.getHours();
            const min = now.getMinutes();
            const day = now.getDay();
            const isBursaOpen = day >= 1 && day <= 5;
            const isCloseWindow = (hour === 15 && min >= 30) || (hour === 16);

            if (isBursaOpen && isCloseWindow && lastAutoUpdate) {
                const nextUpdate = new Date(lastAutoUpdate.getTime() + 3 * 60 * 1000);
                const diff = Math.max(0, Math.floor((nextUpdate - now) / 1000));
                setNextUpdateIn(diff);
                
                if (diff === 0 && !isScanning) {
                    console.log('3-minute window reached. Auto-refreshing...');
                    handleRunScan(true);
                }
            } else {
                setNextUpdateIn(null);
            }
        }, 1000);

        return () => clearInterval(timerInterval);
    }, [lastAutoUpdate, isScanning]);

    const fetchLatestBTST = async () => {
        try {
            const response = await fetch('/.netlify/functions/getBtstLatest');
            const data = await response.json();
            setSnapshot(data);
            setLastAutoUpdate(new Date());
        } catch (err) {
            setError('Gagal memuatkan data BTST.');
        } finally {
            setLoading(false);
        }
    };

    const fetchOwnedPositions = async () => {
        try {
            const response = await fetch('/.netlify/functions/listPositions');
            if (response.ok) {
                const data = await response.json();
                const tickers = new Set(data.map(p => p.ticker_full || p.symbol));
                setOwnedTickers(tickers);
            }
        } catch (err) {
            console.error('Error fetching positions:', err);
        }
    };

    const handleRunScan = async (isSilent = false) => {
        try {
            if (!isSilent) setIsScanning(true);
            const response = await fetch('/.netlify/functions/btstScan', { method: 'POST' });
            if (response.ok) {
                await fetchLatestBTST();
            }
        } catch (err) {
            console.error('Ralat semasa imbasan:', err);
        } finally {
            if (!isSilent) setIsScanning(false);
        }
    };

    if (loading && !snapshot) {
        return (
            <div className="min-h-screen bg-[#0a0a0c] text-white p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                    <p className="text-gray-400 font-medium italic">Menghitung Strategi BTST...</p>
                </div>
            </div>
        );
    }

    const { results = [], scan_date, created_at } = snapshot || {};
    const ownedBTST = results.filter(r => ownedTickers.has(r.ticker));
    const candidates = results.filter(r => !ownedTickers.has(r.ticker));

    const formattedTime = created_at ? new Date(created_at).toLocaleTimeString('ms-MY', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
    }) : '';

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-white pb-24 px-4 md:px-8">
            {/* Header */}
            <header className="py-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-indigo-400" />
                        BTST ENGINE
                    </h1>
                    <p className="text-gray-500 text-sm mt-1 uppercase tracking-widest font-bold">
                        Buy Today, Sell Tomorrow &bull; 3:30 PM Bursa Scanner
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {nextUpdateIn !== null && (
                        <div className="hidden lg:flex flex-col items-end mr-2">
                            <div className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Next Auto Sync In</div>
                            <div className="text-indigo-400 font-black text-sm tabular-nums">
                                {Math.floor(nextUpdateIn / 60)}:{(nextUpdateIn % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                    )}
                    <div className={`
                        bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-xs flex items-center gap-3 transition-all
                        ${isScanning ? 'ring-2 ring-indigo-500/50 bg-indigo-500/5 animate-pulse' : ''}
                    `}>
                        <Clock className={`w-4 h-4 text-indigo-400 ${isScanning ? 'animate-spin' : ''}`} />
                        <div>
                            <div className="text-gray-500 font-bold uppercase tracking-tighter">Imbasan Terakhir</div>
                            <div className="text-white font-black flex items-center gap-2">
                                <span>{scan_date || 'Tiada Data'}</span>
                                {formattedTime && <span className="text-indigo-400/80 text-[10px] font-bold">{formattedTime}</span>}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={handleRunScan}
                        disabled={isScanning}
                        className={`
                            text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg active:scale-95 px-5 flex items-center gap-2
                            ${isScanning 
                                ? 'bg-indigo-800 cursor-not-allowed opacity-80' 
                                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}
                        `}
                    >
                        {isScanning ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Mengimbas...
                            </>
                        ) : 'Imbas Sekarang'}
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto space-y-12">
                {/* Owned Positions Section */}
                {ownedBTST.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <ShoppingCart className="w-5 h-5 text-emerald-400" />
                            <h2 className="text-lg font-black tracking-tight text-emerald-400 uppercase">Pegangan BTST (Sedia Jual)</h2>
                            <div className="bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest border border-emerald-500/20">
                                SELL BEFORE 10:30 AM
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {ownedBTST.map((stock, idx) => (
                                <StockCard 
                                    key={stock.ticker} 
                                    stock={stock} 
                                    rank={idx + 1} 
                                    isOwned={true} 
                                    onClick={() => setSelectedStock(stock)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Candidate List Section */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Star className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-lg font-black tracking-tight text-indigo-400 uppercase">Calon BTST Terbaik</h2>
                        <div className="bg-indigo-500/10 text-indigo-500 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest border border-indigo-500/20">
                            BUY BEFORE 4:55 PM
                        </div>
                    </div>

                    {candidates.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {candidates.map((stock, idx) => (
                                <StockCard 
                                    key={stock.ticker} 
                                    stock={stock} 
                                    rank={idx + 1} 
                                    isOwned={false} 
                                    onClick={() => setSelectedStock(stock)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white/2 border border-dashed border-white/10 rounded-3xl p-12 text-center">
                            <Info className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-400">Tiada Calon BTST</h3>
                            <p className="text-gray-600 max-w-md mx-auto mt-2">
                                Tiada saham yang melepasi kriteria skor tinggi hari ini. Sila buat imbasan semula selepas 3:30 PM.
                            </p>
                        </div>
                    )}
                </section>
            </main>

            {selectedStock && (
                <BTSTModal 
                    stock={selectedStock} 
                    isOwned={ownedTickers.has(selectedStock.ticker)} 
                    onClose={() => {
                        setSelectedStock(null);
                        fetchOwnedPositions();
                    }}
                />
            )}
        </div>
    );
};

const StockCard = ({ stock, rank, isOwned, onClick }) => {
    return (
        <div 
            onClick={onClick}
            className={`
                group relative bg-[#121216] border border-white/5 rounded-2xl p-6 transition-all cursor-pointer overflow-hidden
                hover:border-indigo-500/50 hover:bg-[#16161c] hover:-translate-y-1 active:scale-[0.98]
            `}
        >
            {/* Background Glow */}
            <div className={`absolute -right-12 -top-12 w-24 h-24 blur-[60px] opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity ${isOwned ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>

            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isOwned ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                        #{rank}
                    </div>
                    <div>
                        <h3 className="text-lg font-black tracking-tighter leading-none group-hover:text-indigo-400 transition-colors uppercase">{stock.company}</h3>
                        <p className="text-[10px] text-gray-500 font-bold tracking-widest mt-0.5">{stock.ticker}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xl font-black tracking-tighter">RM {stock.close.toFixed(3)}</div>
                    <div className={`text-[10px] font-black ${stock.changePercent > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-gray-500">
                    <span>BTST SCORE</span>
                    <span className="text-white font-black">{stock.score}/9</span>
                </div>
                {/* Score Bar */}
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-700 ${isOwned ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                        style={{ width: `${(stock.score / 9) * 100}%` }}
                    ></div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
                {stock.isBreakout5D && (
                    <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded">BREAKOUT</span>
                )}
                {stock.rvol >= 1.8 && (
                    <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded">SPIKE</span>
                )}
                {stock.isCloseNearHigh && (
                    <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded">CNH</span>
                )}
            </div>

            <div className="mt-5 flex items-center justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Klik untuk details</span>
                <ChevronRight className="w-4 h-4 text-indigo-500" />
            </div>
        </div>
    );
};

export default BTST;
