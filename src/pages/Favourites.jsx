import React, { useState } from 'react';
import {
    Heart,
    Plus,
    Search,
    ArrowLeft,
    Loader2,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScreener } from '../hooks/useScreener';
import { useFavourites } from '../hooks/useFavourites';
import { ScreenerTable } from '../components/ScreenerTable';
import { StockModal } from '../components/StockModal';
import { usePositions } from '../hooks/usePositions';

const FavouritesPage = () => {
    const navigate = useNavigate();
    const { results, loading, refetch } = useScreener();
    const { favouriteTickers, toggleFavourite, addCustomFavourite, loadingFavs } = useFavourites();
    const { positions, addPosition, removePosition } = usePositions();

    const [showAddModal, setShowAddModal] = useState(false);
    const [newSymbol, setNewSymbol] = useState('');
    const [selectedStock, setSelectedStock] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addStatus, setAddStatus] = useState(''); // 'validating', 'importing', 'computing', 'success', 'error'
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Filter results to show only those in the favourite list
    // If a ticker is in favouriteTickers but not in results yet (e.g. just added), 
    // we create a placeholder so it doesn't "disappear" from the UI.
    const favResults = favouriteTickers.map(ticker => {
        const analyzeResult = (results || []).find(r => r.ticker === ticker);
        if (analyzeResult) return analyzeResult;

        // Pending state placeholder
        return {
            ticker: ticker,
            company: 'Loading Data...',
            score: '...',
            close: 0,
            stats: { rsi14: 0, dropdownPercent: 0 },
            signals: ['PENDING'],
            isPending: true
        };
    });

    // Debounced search for the modal
    React.useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (newSymbol.length >= 2) {
                setIsSearching(true);
                try {
                    const res = await fetch(`/.netlify/functions/searchStocks?q=${newSymbol}`);
                    const data = await res.json();
                    setSearchResults(data || []);
                } catch (e) {
                    console.error("Search error:", e);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [newSymbol]);

    const handleSelectStock = (stock) => {
        setNewSymbol(stock.ticker_code);
        setSearchResults([]);
    };

    const handleAddCustom = async (e) => {
        e.preventDefault();
        if (!newSymbol) return;

        setIsAdding(true);
        setAddStatus('importing');

        try {
            // If the user entered a code that we have in master list, it will resolve automatically
            const res = await addCustomFavourite(newSymbol);
            if (res.success) {
                setAddStatus('computing');
                // Trigger multiple computes to ensure cache is hot
                try {
                    await fetch('/.netlify/functions/computeScreener');
                    refetch(); // Refresh the screener data
                } catch (e) {
                    console.error("Compute error after add:", e);
                }

                setAddStatus('success');
                setTimeout(() => {
                    setNewSymbol('');
                    setShowAddModal(false);
                    setAddStatus('');
                    setIsAdding(false);
                    setSearchResults([]);
                }, 2000);
            } else {
                setAddStatus('error');
                setTimeout(() => {
                    setAddStatus('');
                    setIsAdding(false);
                }, 3000);
            }
        } catch (err) {
            console.error("Error adding custom favourite:", err);
            setAddStatus('error');
            setIsAdding(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-text-primary font-sans p-6 md:p-12 pb-24">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4 group text-sm font-bold uppercase tracking-widest"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Market
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500/10 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                                <Heart className="w-8 h-8 text-red-500 fill-red-500" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white">
                                My Favourites
                            </h1>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-full font-bold transition-all shadow-lg active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Add Custom Ticker
                    </button>
                </div>

                {/* Info Card */}
                <div className="mb-8 p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-primary font-bold text-sm">Experimental Tracking</h4>
                        <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                            Stocks added manually will be tracked in the next EOD sync. If historical data is missing, indicators like MA20/MA50 will appear as "Incomplete" until enough days have been recorded.
                        </p>
                    </div>
                </div>

                {/* Content */}
                {(loading || loadingFavs) ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                        <p className="text-gray-500 font-medium">Loading your favourites...</p>
                    </div>
                ) : (
                    <ScreenerTable
                        data={favResults}
                        onView={setSelectedStock}
                        onToggleFavourite={toggleFavourite}
                        favouriteTickers={favouriteTickers}
                        positions={positions}
                    />
                )}

                {/* Add Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <div className="bg-surface w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-visible animate-in fade-in zoom-in duration-200">
                            <div className="p-8">
                                <h3 className="text-2xl font-bold text-white mb-2">Track New Ticker</h3>
                                <p className="text-gray-500 text-sm mb-6">Enter a Bursa Malaysia symbol (e.g. MAYBANK, PBBANK, AIRPORT) to start monitoring it.</p>

                                <form onSubmit={handleAddCustom} className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Symbol / Ticker</label>
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="e.g. 5209, GASMSIA, MAYBANK"
                                                value={newSymbol}
                                                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                                                className="w-full bg-surfaceHighlight border border-border rounded-xl py-4 pl-12 pr-4 text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-gray-600"
                                            />
                                            {isSearching && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                                                </div>
                                            )}

                                            {searchResults.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-surfaceHighlight border border-border rounded-xl shadow-2xl overflow-y-auto max-h-[250px] z-[110] animate-in fade-in slide-in-from-top-2 duration-200 custom-scrollbar">
                                                    {searchResults.map((stock) => {
                                                        const isFav = favouriteTickers.includes(stock.ticker_full);
                                                        return (
                                                            <div key={stock.ticker_full} className="flex items-center hover:bg-white/5 border-b border-white/5 last:border-0 group">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSelectStock(stock)}
                                                                    className="flex-1 px-4 py-3 text-left flex flex-col transition-colors"
                                                                >
                                                                    <span className="text-white font-bold group-hover:text-primary transition-colors">{stock.company_name}</span>
                                                                    <span className="text-gray-500 text-xs font-mono">{stock.ticker_code}</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleFavourite(stock.ticker_full);
                                                                    }}
                                                                    className={`p-4 transition-colors ${isFav ? 'text-red-500' : 'text-gray-600 hover:text-red-400'}`}
                                                                >
                                                                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {addStatus && (
                                        <div className={`p-4 rounded-xl border text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${addStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                            addStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                                'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                            }`}>
                                            {addStatus === 'importing' && (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                                    <span>Sedang mengambil data pasaran (1 thn)...</span>
                                                </>
                                            )}
                                            {addStatus === 'computing' && (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                                    <span>Menganalisa isyarat Rebound...</span>
                                                </>
                                            )}
                                            {addStatus === 'success' && (
                                                <>
                                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                    <span>Berjaya! Saham telah ditambah.</span>
                                                </>
                                            )}
                                            {addStatus === 'error' && (
                                                <>
                                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                                    <span>Ralat! Sila pastikan simbol adalah betul.</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        {!isAdding && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAddModal(false)}
                                                className="flex-1 py-4 bg-transparent hover:bg-white/5 text-gray-400 font-bold rounded-xl transition-all"
                                            >
                                                Batal
                                            </button>
                                        )}
                                        <button
                                            disabled={isAdding || !newSymbol}
                                            className={`
                                                flex-1 py-4 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2
                                                ${addStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-primary hover:bg-primary-hover text-white'}
                                                ${isAdding ? 'opacity-70 cursor-not-allowed' : ''}
                                                ${!newSymbol ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : ''}
                                            `}
                                        >
                                            {isAdding ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : addStatus === 'success' ? (
                                                <CheckCircle className="w-5 h-5" />
                                            ) : (
                                                <Plus className="w-5 h-5" />
                                            )}
                                            {addStatus === 'importing' ? 'Mendos data...' :
                                                addStatus === 'computing' ? 'Menganalisa...' :
                                                    addStatus === 'success' ? 'Selesai' :
                                                        isAdding ? 'Sila tunggu...' : 'Tambah Kaunter'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {selectedStock && (
                    <StockModal
                        stock={selectedStock}
                        onClose={() => setSelectedStock(null)}
                        favouriteTickers={favouriteTickers}
                        onToggleFavourite={toggleFavourite}
                        positions={positions}
                        onSavePosition={addPosition}
                        onRemovePosition={removePosition}
                    />
                )}
            </div>
        </div>
    );
};

export default FavouritesPage;
