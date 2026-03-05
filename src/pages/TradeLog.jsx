import React, { useState } from 'react';
import { useTradeHistory } from '../hooks/useTradeHistory';
import { usePositions } from '../hooks/usePositions';
import { useScreener } from '../hooks/useScreener';
import { TrendingUp, TrendingDown, Trash2, Edit2, Calendar, DollarSign, BarChart3, ArrowLeft, Search, Filter, Briefcase, History, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const TradeLog = () => {
    const { history, loading: loadingHistory, deleteTrade, updateTrade } = useTradeHistory();
    const { positions, loading: loadingPositions } = usePositions();
    const { results: screenerData } = useScreener();

    const [activeType, setActiveType] = useState('REAL'); // REAL vs PAPER
    const [activeStatus, setActiveStatus] = useState('ACTIVE'); // ACTIVE vs HISTORY
    const [activeMarket, setActiveMarket] = useState('US'); // US vs BURSA
    const [searchQuery, setSearchQuery] = useState('');
    const [editingTrade, setEditingTrade] = useState(null);

    const loading = loadingHistory || loadingPositions;

    // Process Active Positions
    const activeList = Object.values(positions).map(pos => {
        const liveStock = screenerData.find(s => s.ticker === pos.ticker);
        const isBursa = pos.ticker.endsWith('.KL');
        const currency = isBursa ? 'RM' : 'USD';

        const entryPrice = parseFloat(pos.entryPrice || 0);
        const currentPrice = liveStock?.close || entryPrice;
        const qty = parseFloat(pos.quantity || 0);

        const pnl_amount = (currentPrice - entryPrice) * qty;
        const pnl_percent = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

        return {
            id: pos.ticker,
            ticker_full: pos.ticker,
            short_name: liveStock?.company || pos.ticker,
            entry_price: entryPrice,
            sell_price: null,
            current_price: currentPrice,
            quantity: qty,
            strategy: pos.strategy || 'N/A',
            buy_date: pos.buyDate,
            sell_date: null,
            pnl_amount,
            pnl_percent,
            notes: pos.notes || "",
            trade_type: 'REAL',
            is_active: true,
            currency
        };
    });

    const filteredActive = activeList.filter(t =>
        (activeType === 'REAL') &&
        (activeMarket === 'US' ? !t.ticker_full.endsWith('.KL') : t.ticker_full.endsWith('.KL')) &&
        (t.ticker_full.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredHistory = history.filter(t =>
        t.trade_type === activeType &&
        (activeMarket === 'US' ? !t.ticker_full.endsWith('.KL') : t.ticker_full.endsWith('.KL')) &&
        (
            t.ticker_full.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.short_name && t.short_name.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    ).map(t => ({
        ...t,
        currency: t.ticker_full.endsWith('.KL') ? 'RM' : 'USD',
        is_active: false
    }));

    const displayResults = activeStatus === 'ACTIVE' ? filteredActive : filteredHistory;

    // Calc Stats
    const totalPnL = displayResults.reduce((sum, t) => sum + parseFloat(t.pnl_amount || 0), 0);
    const winRate = filteredHistory.length > 0
        ? (filteredHistory.filter(t => parseFloat(t.pnl_amount) > 0).length / filteredHistory.length * 100).toFixed(1)
        : 0;

    const handleDelete = (id) => {
        if (window.confirm("Padam rekod ini?")) {
            deleteTrade(id);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-32">
            {/* Header */}
            <header className="bg-surface/40 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 px-6 py-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs font-black uppercase tracking-widest mb-4">
                            <ArrowLeft className="w-4 h-4" /> Balas ke Dashboard
                        </Link>
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase flex items-center gap-4">
                            Rekod <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">Trade</span>
                        </h1>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2 ml-1">Pantau prestasi dan jurnal setiap trade anda.</p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Total PnL ({activeMarket} - {activeStatus})</div>
                            <div className={`text-2xl font-black italic ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {activeMarket === 'US' ? 'USD' : 'RM'} {totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="w-px h-10 bg-white/5"></div>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">History Win Rate</div>
                            <div className="text-2xl font-black italic text-white">{winRate}%</div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                {/* Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/5 w-fit">
                                {[
                                    { id: 'ACTIVE', label: 'Holdings', icon: <Briefcase className="w-3.5 h-3.5" /> },
                                    { id: 'HISTORY', label: 'History', icon: <History className="w-3.5 h-3.5" /> }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveStatus(tab.id)}
                                        className={`
                                            flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                                            ${activeStatus === tab.id
                                                ? 'bg-white text-black shadow-lg shadow-white/10'
                                                : 'text-gray-500 hover:text-gray-300'}
                                        `}
                                    >
                                        {tab.icon}
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/5 w-fit">
                                {['US', 'BURSA'].map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setActiveMarket(m)}
                                        className={`
                                            px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                                            ${activeMarket === m
                                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                                : 'text-gray-500 hover:text-gray-300'}
                                        `}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/5 w-fit">
                            {['REAL', 'PAPER'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setActiveType(type)}
                                    className={`
                                        px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
                                        ${activeType === type
                                            ? (type === 'REAL' ? 'bg-orange-500/20 text-orange-400' : 'bg-indigo-500/20 text-indigo-400')
                                            : 'text-gray-600 hover:text-gray-400'}
                                    `}
                                >
                                    {type === 'REAL' ? 'Real Money' : 'Paper Trade'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Cari ticker..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-white/5 border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-xs font-bold text-white outline-none focus:border-orange-500/30 focus:ring-4 focus:ring-orange-500/5 transition-all w-64 lg:w-80"
                            />
                        </div>
                        <button className="p-3 bg-white/5 border border-white/5 rounded-2xl text-gray-500 hover:text-white transition-colors">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* History Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-40">
                        <div className="w-8 h-8 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                    </div>
                ) : displayResults.length === 0 ? (
                    <div className="bg-surface/20 border border-white/5 rounded-[2.5rem] py-32 flex flex-col items-center justify-center text-center opacity-50">
                        <BarChart3 className="w-12 h-12 text-gray-700 mb-6" />
                        <h3 className="text-xl font-black uppercase italic tracking-tighter">Tiada Rekod Dijumpai</h3>
                        <p className="text-sm text-gray-500 max-w-xs mt-2">
                            {activeStatus === 'ACTIVE'
                                ? `Anda tiada sebarang pegangan (holdings) aktif dalam pasaran ${activeMarket} buat masa ini.`
                                : `Anda belum menjual sebarang saham ${activeMarket} atau tiada padanan carian.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayResults.map((trade) => (
                            <div key={trade.id} className="group bg-surface/30 hover:bg-surface/50 border border-white/5 hover:border-white/10 rounded-[2rem] p-6 transition-all duration-300">
                                <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                                    {/* Stock Info */}
                                    <div className="min-w-[200px]">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">
                                            {trade.is_active
                                                ? (trade.buy_date ? `Aktif sejak ${format(new Date(trade.buy_date), 'dd MMM yyyy')}` : 'Pegangan Aktif')
                                                : (trade.sell_date ? format(new Date(trade.sell_date), 'dd MMM yyyy') : '-')}
                                        </div>
                                        <div className="text-2xl font-black italic tracking-tighter uppercase text-white group-hover:text-orange-400 transition-colors">
                                            {trade.short_name || trade.ticker_full}
                                        </div>
                                        <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{trade.ticker_full}</div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${trade.strategy === 'momentum' ? 'bg-orange-500/10 text-orange-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                {trade.strategy}
                                            </span>
                                            <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest flex items-center gap-1">
                                                <Calendar className="w-2.5 h-2.5" /> {trade.is_active ? 'Masuk pada:' : 'Tarikh Masuk:'} {trade.buy_date ? format(new Date(trade.buy_date), 'dd/MM') : '-'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Numbers */}
                                    <div className="lg:w-[450px] grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <div className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Kuantiti</div>
                                            <div className="text-sm font-black text-white">{trade.quantity.toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">UNIT</span></div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">{trade.is_active ? 'Hrg Semasa' : 'Hrg Jual'}</div>
                                            <div className="text-sm font-black text-white">{trade.currency} {parseFloat(trade.is_active ? trade.current_price : trade.sell_price).toFixed(3)}</div>
                                            <div className="text-[9px] text-gray-500 font-bold uppercase whitespace-nowrap">Kos: {parseFloat(trade.entry_price).toFixed(3)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">PnL %</div>
                                            <div className={`text-sm font-black flex items-center gap-1.5 ${trade.pnl_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {trade.pnl_percent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                                {parseFloat(trade.pnl_percent).toFixed(2)}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">{trade.is_active ? 'Floating P/L' : 'Untung/Rugi'}</div>
                                            <div className={`text-sm font-black italic ${trade.pnl_amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {trade.currency} {parseFloat(trade.pnl_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div className="flex-1 max-w-[200px] flex flex-col justify-center">
                                        <div className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Nota</div>
                                        <p className="text-[11px] text-gray-400 italic line-clamp-2 leading-tight">
                                            {trade.notes || "Tiada nota..."}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col justify-center lg:pl-8 lg:border-l border-white/5">
                                        <div className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Tindakan</div>
                                        <div className="flex items-center gap-3">
                                            {trade.is_active ? (
                                                <Link
                                                    to={trade.ticker_full.endsWith('.KL') ? '/bursa' : '/'}
                                                    className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] text-emerald-400 font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap flex items-center gap-2"
                                                >
                                                    <Activity className="w-3.5 h-3.5" /> Manage
                                                </Link>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => setEditingTrade(trade)}
                                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[10px] text-gray-500 hover:text-white font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(trade.id)}
                                                        className="p-2 hover:bg-red-500/10 text-gray-600 hover:text-red-500 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Edit Modal (Simple version) */}
            {editingTrade && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#151518] border border-white/10 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl">
                        <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-8 flex items-center gap-3">
                            <Edit2 className="w-6 h-6 text-orange-500" /> Kemaskini Rekod
                        </h4>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Hrg Beli</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        defaultValue={editingTrade.entry_price}
                                        id="edit-entry"
                                        className="w-full bg-background border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-orange-500/40 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Hrg Jual</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        defaultValue={editingTrade.sell_price}
                                        id="edit-sell"
                                        className="w-full bg-background border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-orange-500/40 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nota</label>
                                <textarea
                                    defaultValue={editingTrade.notes}
                                    id="edit-notes"
                                    className="w-full bg-background border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-orange-500/40 outline-none min-h-[100px] resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button onClick={() => setEditingTrade(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-500 hover:text-white transition-colors">Batal</button>
                            <button
                                onClick={async () => {
                                    const entry = document.getElementById('edit-entry').value;
                                    const sell = document.getElementById('edit-sell').value;
                                    const notes = document.getElementById('edit-notes').value;
                                    await updateTrade(editingTrade.id, {
                                        entry_price: parseFloat(entry),
                                        sell_price: parseFloat(sell),
                                        notes
                                    });
                                    setEditingTrade(null);
                                }}
                                className="flex-[2] bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase shadow-xl shadow-orange-500/20"
                            >
                                Simpan Perubahan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradeLog;
