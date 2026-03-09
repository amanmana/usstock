import React, { useState } from 'react';
import {
    Heart,
    Plus,
    Search,
    ArrowLeft,
    Loader2,
    AlertCircle,
    CheckCircle,
    X,
    RefreshCw,
    Clock
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

    // Force fetch the universal universe for both US and Bursa scores
    React.useEffect(() => {
        refetch('universe_all_real');
    }, []);
    const { favouriteTickers, favouriteDetails, toggleFavourite, toggleAlert, addCustomFavourite, loadingFavs } = useFavourites();
    const { positions, addPosition, removePosition, sellPosition } = usePositions();

    const [showAddModal, setShowAddModal] = useState(false);
    const [newSymbol, setNewSymbol] = useState('');
    const [activeTab, setActiveTab] = useState('US');
    const [selectedStock, setSelectedStock] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addStatus, setAddStatus] = useState(''); // 'validating', 'importing', 'computing', 'success', 'error'
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [localResults, setLocalResults] = useState({}); // Ticker -> updated stock object

    // Latest Prices Tracking
    const [latestPrices, setLatestPrices] = useState({}); // Ticker -> { close, volume, updatedAt }
    const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
    const [pricesUpdatedAt, setPricesUpdatedAt] = useState(null);
    const [nextUpdateIn, setNextUpdateIn] = useState(300); // Countdown in seconds

    const fetchLatestPrices = async (tickers) => {
        if (!tickers || tickers.length === 0 || isRefreshingPrices) return;
        setIsRefreshingPrices(true);
        try {
            const res = await fetch('/.netlify/functions/getLatestPrices', {
                method: 'POST',
                body: JSON.stringify({ tickers })
            });
            if (res.ok) {
                const data = await res.json();
                const priceMap = {};
                data.forEach(item => {
                    if (item.close) {
                        priceMap[item.ticker] = {
                            ...item,
                            updatedAt: new Date()
                        };
                    }
                });
                setLatestPrices(prev => ({ ...prev, ...priceMap }));
                setPricesUpdatedAt(new Date());
                setNextUpdateIn(300); // Reset countdown on success
            }
        } catch (e) {
            console.error("Error fetching latest prices:", e);
        } finally {
            setIsRefreshingPrices(false);
        }
    };

    // Initial fetch when tickers are loaded
    React.useEffect(() => {
        if (favouriteTickers.length > 0 && Object.keys(latestPrices).length === 0) {
            fetchLatestPrices(favouriteTickers);
        }
    }, [favouriteTickers.length]);

    // Countdown and Polling Logic combined
    React.useEffect(() => {
        const timer = setInterval(() => {
            setNextUpdateIn((prev) => {
                if (prev <= 1) {
                    if (favouriteTickers.length > 0) {
                        fetchLatestPrices(favouriteTickers);
                    }
                    return 300;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [favouriteTickers]);

    // 1. Get unique stocks only (to avoid duplicates from aliases like 5080 and 5080.KL)
    const uniqueTickers = Array.from(new Set(
        favouriteTickers
            .map(t => favouriteDetails[t]?.ticker_full)
            .filter(Boolean)
    ));

    // 2. Map results with latest data
    const favResults = uniqueTickers.map(ticker => {
        const details = favouriteDetails[ticker] || {};
        const localStock = localResults[ticker];
        const analyzeResult = (results || []).find(r => r.ticker === ticker);
        const latestInfo = latestPrices[ticker];

        const base = localStock || analyzeResult;
        const market = details.market || (ticker.endsWith('.KL') ? 'MYR' : 'US');

        if (base) {
            return {
                ...base,
                ticker: ticker,
                market,
                close: latestInfo?.close || base.close,
                score: latestInfo?.score ?? base.score,
                momentumScore: latestInfo?.momentumScore ?? base.momentumScore,
                signals: latestInfo?.signals || base.signals,
                stats: {
                    ...base.stats,
                    rsi14: latestInfo?.rsi14 ?? base.stats?.rsi14,
                    dropdownPercent: latestInfo?.dropdownPercent ?? base.stats?.dropdownPercent
                },
                isLivePrice: !!latestInfo || !!localStock
            };
        }

        // Pending state placeholder
        return {
            ticker: ticker,
            market,
            company: details.company_name || 'Loading Data...',
            score: latestInfo?.score || null,
            momentumScore: latestInfo?.momentumScore || null,
            close: latestInfo?.close || 0,
            isLivePrice: !!latestInfo,
            stats: {
                rsi14: latestInfo?.rsi14 || null,
                dropdownPercent: latestInfo?.dropdownPercent || null
            },
            signals: latestInfo?.signals || ['PENDING'],
            isPending: !latestInfo
        };
    });

    // 3. Categorize and filter results based on robust market field
    const usStocks = favResults.filter(s => s.market?.includes('US'));
    const bursaStocks = favResults.filter(s => s.market?.includes('MYR') || s.market?.includes('KLSE'));
    const displayResults = activeTab === 'US' ? usStocks : bursaStocks;

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

                {/* Info Card with Refresh */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="flex-1 p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-4">
                        <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-primary font-bold text-sm">Real-time Tracking</h4>
                            <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                                Kaunter kegemaran anda akan dikemaskini dengan harga pasaran terkini dari Yahoo Finance secara automatik setiap 5 minit.
                            </p>
                        </div>
                    </div>

                    {favouriteTickers.length > 0 && (
                        <div className="flex items-center gap-4 bg-surfaceHighlight/30 border border-border px-6 py-4 rounded-2xl shrink-0">
                            <div className="text-right">
                                <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1 shadow-sm">
                                    Next Sync in {Math.floor(nextUpdateIn / 60)}:{(nextUpdateIn % 60).toString().padStart(2, '0')}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-xs text-white font-bold">
                                        {pricesUpdatedAt ? `Kemaskini: ${pricesUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Sedang mengambil...'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => fetchLatestPrices(favouriteTickers)}
                                disabled={isRefreshingPrices}
                                className={`p-3 rounded-xl transition-all relative overflow-hidden group ${isRefreshingPrices ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                title="Refresh Prices Now"
                            >
                                <RefreshCw className={`w-5 h-5 relative z-10 ${isRefreshingPrices ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                {isRefreshingPrices && (
                                    <div className="absolute inset-0 bg-primary/20 animate-pulse"></div>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Custom Tabs */}
                <div className="flex items-center gap-2 mb-8 bg-surfaceHighlight/20 p-1.5 rounded-2xl w-fit border border-white/5">
                    <button
                        onClick={() => setActiveTab('US')}
                        className={`flex items-center gap-3 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'US'
                            ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        🇺🇸 US Market
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'US' ? 'bg-black/10 text-black' : 'bg-white/5 text-gray-500'}`}>
                            {usStocks.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('Bursa')}
                        className={`flex items-center gap-3 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'Bursa'
                            ? 'bg-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        🇲🇾 Bursa Malaysia
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'Bursa' ? 'bg-black/20 text-white' : 'bg-white/5 text-gray-500'}`}>
                            {bursaStocks.length}
                        </span>
                    </button>
                </div>

                {/* Content */}
                {(loading || loadingFavs) ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                        <p className="text-gray-500 font-medium">Loading your favourites...</p>
                    </div>
                ) : displayResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-surfaceHighlight/5 rounded-3xl border border-dashed border-white/10">
                        <div className="p-6 bg-white/5 rounded-full mb-4">
                            <Heart className="w-10 h-10 text-gray-700" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Tiada Saham {activeTab}</h3>
                        <p className="text-gray-500 max-w-sm text-center">
                            Anda belum menambah sebarang kaunter kegemaran untuk pasaran {activeTab === 'US' ? 'Amerika Syarikat' : 'Bursa Malaysia'}.
                        </p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-full transition-all border border-white/10"
                        >
                            Tambah Sekarang
                        </button>
                    </div>
                ) : (
                    <ScreenerTable
                        data={displayResults}
                        onView={setSelectedStock}
                        onToggleFavourite={toggleFavourite}
                        favouriteTickers={favouriteTickers}
                        favouriteDetails={favouriteDetails}
                        positions={positions}
                        activeTab={activeTab === 'US' ? 'hybrid' : 'bursa'}
                        market={activeTab === 'US' ? 'USD' : 'MYR'}
                        variant="monitor"
                        loading={isRefreshingPrices}
                    />
                )}

                {/* Add Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <div className="bg-surface w-full max-w-md border border-border shadow-2xl rounded-3xl overflow-visible animate-in fade-in zoom-in duration-200 relative">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="absolute top-6 right-6 p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-all z-10"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="p-8">
                                <h3 className="text-2xl font-bold text-white mb-2">Track New Ticker</h3>
                                <p className="text-gray-500 text-sm mb-6">Enter a US Market symbol (e.g. AAPL, MSFT, TSLA) to start monitoring it.</p>

                                <form onSubmit={handleAddCustom} className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Symbol / Ticker</label>
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="e.g. AAPL, MSFT, TSLA"
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
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-white font-bold group-hover:text-primary transition-colors text-sm">{stock.company_name}</span>
                                                                        {stock.quoteType && (
                                                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${stock.quoteType === 'ETF' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                                                                {stock.quoteType}
                                                                            </span>
                                                                        )}
                                                                        {stock.is_yahoo_result && (
                                                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/20">
                                                                                Yahoo
                                                                            </span>
                                                                        )}
                                                                    </div>
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
                        strategy="hybrid"
                        favouriteTickers={favouriteTickers}
                        favouriteDetails={favouriteDetails}
                        onToggleFavourite={toggleFavourite}
                        onToggleAlert={toggleAlert}
                        positions={positions}
                        onSavePosition={addPosition}
                        onRemovePosition={removePosition}
                        onSellPosition={sellPosition}
                        onStockUpdate={(ticker, updatedStock) => {
                            setLocalResults(prev => ({
                                ...prev,
                                [ticker]: updatedStock
                            }));
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default FavouritesPage;
