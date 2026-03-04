import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, Settings, Trash2, Plus, RefreshCw, CheckSquare, Square,
    AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp, Upload, Zap, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StockManagerPage = () => {
    const navigate = useNavigate();

    // --- Active Stocks State ---
    const [stocks, setStocks] = useState([]);
    const [loadingStocks, setLoadingStocks] = useState(true);
    const [selected, setSelected] = useState(new Set());
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [deactivateStatus, setDeactivateStatus] = useState('');

    // --- Import State ---
    const [activeImportTab, setActiveImportTab] = useState('spus'); // 'spus' | 'csv'
    const [spusHoldings, setSpusHoldings] = useState([]);
    const [loadingSpus, setLoadingSpus] = useState(false);
    const [spusSelected, setSpusSelected] = useState(new Set());
    const [csvInput, setCsvInput] = useState('');
    const [parsedCsv, setParsedCsv] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);

    // --- Fetch active stocks ---
    const fetchStocks = async () => {
        setLoadingStocks(true);
        try {
            const res = await fetch('/.netlify/functions/listAllStocks');
            if (res.ok) {
                const data = await res.json();
                setStocks(data);
            }
        } catch (e) {
            console.error('Failed to load stocks:', e);
        } finally {
            setLoadingStocks(false);
        }
    };

    useEffect(() => { fetchStocks(); }, []);

    // --- Selection Handlers ---
    const toggleSelect = (ticker) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(ticker) ? next.delete(ticker) : next.add(ticker);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === stocks.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(stocks.map(s => s.ticker_full)));
        }
    };

    // --- Deactivate Selected ---
    const handleDeactivate = async () => {
        if (selected.size === 0) return;
        if (!window.confirm(`Anda pasti mahu nyahaktifkan ${selected.size} counter?`)) return;

        setIsDeactivating(true);
        setDeactivateStatus('loading');
        try {
            const res = await fetch('/.netlify/functions/bulkDeactivateTickers', {
                method: 'POST',
                body: JSON.stringify({ tickers: Array.from(selected) })
            });
            const data = await res.json();
            if (data.success) {
                setDeactivateStatus('success');
                setSelected(new Set());
                await fetchStocks();
                setTimeout(() => setDeactivateStatus(''), 3000);
            } else {
                setDeactivateStatus('error');
            }
        } catch (e) {
            setDeactivateStatus('error');
        } finally {
            setIsDeactivating(false);
        }
    };

    // --- SPUS Holdings ---
    const fetchSpusHoldings = async () => {
        setLoadingSpus(true);
        setSpusHoldings([]);
        setSpusSelected(new Set());
        try {
            const res = await fetch('/.netlify/functions/fetchSpusHoldings');
            const data = await res.json();
            if (data.success) {
                const existingTickers = new Set(stocks.map(s => s.ticker_full));
                const filtered = data.holdings.filter(h => !existingTickers.has(h.symbol));
                setSpusHoldings(filtered);
            }
        } catch (e) {
            console.error('SPUS fetch failed:', e);
        } finally {
            setLoadingSpus(false);
        }
    };

    const toggleSpusSelect = (symbol) => {
        setSpusSelected(prev => {
            const next = new Set(prev);
            next.has(symbol) ? next.delete(symbol) : next.add(symbol);
            return next;
        });
    };

    const toggleAllSpus = () => {
        if (spusSelected.size === spusHoldings.length) {
            setSpusSelected(new Set());
        } else {
            setSpusSelected(new Set(spusHoldings.map(h => h.symbol)));
        }
    };

    // --- CSV Parsing ---
    const handleParseCsv = () => {
        const lines = csvInput
            .split(/[\n,;]+/)
            .map(t => t.trim().toUpperCase())
            .filter(t => t.length > 0 && t.length <= 10 && /^[A-Z\-\.]+$/.test(t));
        const unique = [...new Set(lines)];
        setParsedCsv(unique);
    };

    // --- Bulk Import ---
    const handleImport = async (tickersToAdd) => {
        if (!tickersToAdd || tickersToAdd.length === 0) return;
        setIsImporting(true);
        setImportResult(null);
        try {
            const res = await fetch('/.netlify/functions/bulkAddTickers', {
                method: 'POST',
                body: JSON.stringify({ tickers: tickersToAdd })
            });
            const data = await res.json();
            setImportResult(data);
            if (data.added?.length > 0) {
                await fetchStocks();
                setSpusSelected(new Set());
                setParsedCsv([]);
                setCsvInput('');
            }
        } catch (e) {
            setImportResult({ error: e.message });
        } finally {
            setIsImporting(false);
        }
    };

    const sharíahCount = stocks.filter(s => s.shariah_status === 'SHARIAH').length;
    const nonShariahCount = stocks.filter(s => s.shariah_status !== 'SHARIAH').length;

    return (
        <div className="min-h-screen bg-background text-text-primary font-sans p-6 md:p-10 pb-28">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div>
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group text-sm font-bold uppercase tracking-widest"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Market
                    </button>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/10 rounded-2xl">
                                <Settings className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-extrabold tracking-tighter text-white">Stock Manager</h1>
                                <p className="text-gray-500 text-sm mt-0.5">Urus universe saham yang dianalisa oleh sistem</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/5 border border-white/[0.02] rounded-2xl p-4 text-center">
                        <div className="text-3xl font-black text-white">{stocks.length}</div>
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Total Aktif</div>
                    </div>
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 text-center">
                        <div className="text-3xl font-black text-emerald-400">{sharíahCount}</div>
                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">✅ Syariah</div>
                    </div>
                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 text-center">
                        <div className="text-3xl font-black text-red-400">{nonShariahCount}</div>
                        <div className="text-[10px] font-black text-red-600 uppercase tracking-widest mt-1">❌ Non-Syariah / Unknown</div>
                    </div>
                </div>

                {/* Section 1: Active Counters */}
                <div className="bg-white/3 border border-white/[0.02] rounded-3xl overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm font-black uppercase tracking-widest text-white">Counter Aktif</h2>
                            {loadingStocks && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                        </div>
                        <div className="flex items-center gap-3">
                            {selected.size > 0 && (
                                <button
                                    onClick={handleDeactivate}
                                    disabled={isDeactivating}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-black uppercase transition-all"
                                >
                                    {isDeactivating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    Nyahaktifkan ({selected.size})
                                </button>
                            )}
                            <button
                                onClick={fetchStocks}
                                className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
                                title="Refresh"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Status Feedback */}
                    {deactivateStatus && (
                        <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 ${deactivateStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : deactivateStatus === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                            {deactivateStatus === 'success' && <><CheckCircle className="w-4 h-4" /> Counter berjaya dinyahaktifkan!</>}
                            {deactivateStatus === 'error' && <><AlertCircle className="w-4 h-4" /> Ralat! Cuba lagi.</>}
                            {deactivateStatus === 'loading' && <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>}
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/[0.02]">
                                    <th className="px-6 py-3 text-left">
                                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-white transition-colors">
                                            {selected.size === stocks.length && stocks.length > 0
                                                ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                                                : <Square className="w-4 h-4" />}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Ticker</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Nama Syarikat</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Status Syariah</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">Sumber</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingStocks ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-400" />
                                        Memuatkan senarai counter...
                                    </td></tr>
                                ) : stocks.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Tiada counter aktif.</td></tr>
                                ) : stocks.map(stock => (
                                    <tr
                                        key={stock.ticker_full}
                                        className={`border-b border-white/[0.02] hover:bg-white/3 transition-colors cursor-pointer ${selected.has(stock.ticker_full) ? 'bg-red-500/5' : ''}`}
                                        onClick={() => toggleSelect(stock.ticker_full)}
                                    >
                                        <td className="px-6 py-3">
                                            {selected.has(stock.ticker_full)
                                                ? <CheckSquare className="w-4 h-4 text-red-400" />
                                                : <Square className="w-4 h-4 text-gray-600" />}
                                        </td>
                                        <td className="px-4 py-3 font-black text-white">{stock.ticker_full}</td>
                                        <td className="px-4 py-3 text-gray-400">{stock.company_name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${stock.shariah_status === 'SHARIAH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                {stock.shariah_status || 'UNKNOWN'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 text-[9px] font-mono">{stock.source_origin || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Section 2: Import Syariah */}
                <div className="bg-white/3 border border-white/5 rounded-3xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5">
                        <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-400" /> Import Counter Syariah
                        </h2>
                    </div>

                    {/* Import Tabs */}
                    <div className="flex border-b border-white/5">
                        <button
                            onClick={() => setActiveImportTab('spus')}
                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeImportTab === 'spus' ? 'text-white border-b-2 border-indigo-400' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Zap className="w-3.5 h-3.5" /> Auto dari SPUS ETF
                        </button>
                        <button
                            onClick={() => setActiveImportTab('csv')}
                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeImportTab === 'csv' ? 'text-white border-b-2 border-emerald-400' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Upload className="w-3.5 h-3.5" /> Paste Senarai Ticker
                        </button>
                    </div>

                    <div className="p-6">
                        {/* SPUS Tab */}
                        {activeImportTab === 'spus' && (
                            <div className="space-y-4">
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Sistem akan mengambil senarai counter Syariah dari <strong className="text-white">SPUS ETF</strong> (SP Funds S&P 500 Sharia Industry Exclusions ETF) — sebuah ETF yang telah ditapis khusus untuk pematuhan Syariah. Counter yang sudah wujud dalam sistem akan ditapis keluar secara automatik.
                                </p>
                                <button
                                    onClick={fetchSpusHoldings}
                                    disabled={loadingSpus}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-black uppercase transition-all"
                                >
                                    {loadingSpus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    {loadingSpus ? 'Sedang Mengambil...' : 'Ambil Senarai SPUS'}
                                </button>

                                {spusHoldings.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">{spusHoldings.length} counter baharu ditemui</span>
                                            <button onClick={toggleAllSpus} className="text-xs text-indigo-400 hover:text-white font-bold transition-colors">
                                                {spusSelected.size === spusHoldings.length ? 'Nyahpilih Semua' : 'Pilih Semua'}
                                            </button>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto rounded-xl border border-white/5 custom-scrollbar">
                                            {spusHoldings.map(h => (
                                                <div
                                                    key={h.symbol}
                                                    onClick={() => toggleSpusSelect(h.symbol)}
                                                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-white/[0.02] hover:bg-white/5 transition-colors ${spusSelected.has(h.symbol) ? 'bg-indigo-500/5' : ''}`}
                                                >
                                                    {spusSelected.has(h.symbol)
                                                        ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                        : <Square className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                                                    <span className="text-xs font-black text-white">{h.symbol}</span>
                                                    <span className="text-xs text-gray-500">{h.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => handleImport(Array.from(spusSelected))}
                                            disabled={isImporting || spusSelected.size === 0}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-black uppercase transition-all"
                                        >
                                            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            {isImporting ? 'Mengimport...' : `Import ${spusSelected.size} Counter`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CSV Tab */}
                        {activeImportTab === 'csv' && (
                            <div className="space-y-4">
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Tampal senarai ticker yang anda ingin tambah. Boleh gunakan koma, titik koma, atau baris baharu sebagai pemisah (contoh: <span className="text-white font-mono">AAPL, MSFT, NVDA</span>).
                                </p>
                                <textarea
                                    value={csvInput}
                                    onChange={e => { setCsvInput(e.target.value); setParsedCsv([]); }}
                                    placeholder={'AAPL\nMSFT\nNVDA\natau\nAAPL, MSFT, NVDA'}
                                    className="w-full bg-background/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all min-h-[120px] resize-none placeholder:text-gray-600"
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleParseCsv}
                                        disabled={!csvInput.trim()}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white border border-white/10 rounded-xl text-xs font-black uppercase transition-all"
                                    >
                                        <CheckSquare className="w-4 h-4" /> Parse & Preview
                                    </button>
                                    {parsedCsv.length > 0 && (
                                        <button onClick={() => { setParsedCsv([]); setCsvInput(''); }} className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white rounded-xl transition-all">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {parsedCsv.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {parsedCsv.map(t => (
                                                <span key={t} className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-black">{t}</span>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-gray-500">{parsedCsv.length} ticker akan diimport sebagai SHARIAH</p>
                                        <button
                                            onClick={() => handleImport(parsedCsv)}
                                            disabled={isImporting}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-black uppercase transition-all"
                                        >
                                            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            {isImporting ? 'Mengimport...' : `Import ${parsedCsv.length} Counter`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Import Result */}
                        {importResult && (
                            <div className={`mt-4 p-4 rounded-xl border text-xs ${importResult.error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                {importResult.error ? (
                                    <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Ralat: {importResult.error}</div>
                                ) : (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 font-bold"><CheckCircle className="w-4 h-4" /> Import Selesai</div>
                                        <div>✅ Berjaya ditambah: <strong>{importResult.added?.length || 0}</strong> counter</div>
                                        {importResult.skipped?.length > 0 && <div>⏭️ Dilangkau (sudah ada): <strong>{importResult.skipped.length}</strong></div>}
                                        {importResult.errors?.length > 0 && <div className="text-red-400">❌ Gagal: {importResult.errors.map(e => e.ticker).join(', ')}</div>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockManagerPage;
