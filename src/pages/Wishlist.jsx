import React, { useState, useEffect } from 'react';
import {
    Star,
    Plus,
    Search,
    ArrowLeft,
    Loader2,
    AlertCircle,
    CheckCircle,
    X,
    RefreshCw,
    Clock,
    Trash2,
    Zap,
    TrendingUp,
    Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScreener } from '../hooks/useScreener';
import { useFavourites } from '../hooks/useFavourites';
import { ScreenerTable } from '../components/ScreenerTable';
import { StockModal } from '../components/StockModal';
import { usePositions } from '../hooks/usePositions';

const WishlistPage = () => {
    const navigate = useNavigate();
    const { results, loading, refetch } = useScreener();

    // Core Wishlist State
    const [wishlist, setWishlist] = useState(() => {
        const saved = localStorage.getItem('brs_wishlist');
        return saved ? JSON.parse(saved) : [];
    });

    const [analyzedStocks, setAnalyzedStocks] = useState({}); // Ticker -> full stock data
    const [isFiltering, setIsFiltering] = useState(false);
    const [filteringTicker, setFilteringTicker] = useState(null);
    const [selectedStock, setSelectedStock] = useState(null);
    const [activeTab, setActiveTab] = useState('Wishlist');

    const { favouriteTickers, favouriteDetails, toggleFavourite, toggleAlert } = useFavourites();
    const { positions, addPosition, removePosition, sellPosition } = usePositions();

    // Persistence
    useEffect(() => {
        localStorage.setItem('brs_wishlist', JSON.stringify(wishlist));
    }, [wishlist]);

    // Force fetch all data once to have hybrid candidates ready
    useEffect(() => {
        refetch('universe_all_real');
    }, []);

    const addHybridStocks = (market) => {
        if (!results) return;

        // Filter Score 7-9
        const candidates = results.filter(s => {
            if (market === 'US' && (s.market === 'MYR' || s.market === 'KLSE')) return false;
            if (market === 'Bursa' && !(s.market === 'MYR' || s.market === 'KLSE')) return false;

            const score = Math.max(parseFloat(s.score || 0), parseFloat(s.momentumScore || 0));
            return score >= 7 && score <= 9.5; // Up to 9.5 to catch higher end of 9
        });

        // Add to wishlist without duplicates
        const newTickers = [...new Set([...wishlist, ...candidates.map(s => s.ticker)])];
        setWishlist(newTickers);

        // Merge candidate data into analyzedStocks temporarily so they show up
        const newAnalyzed = { ...analyzedStocks };
        candidates.forEach(s => {
            if (!newAnalyzed[s.ticker]) {
                newAnalyzed[s.ticker] = s;
            }
        });
        setAnalyzedStocks(newAnalyzed);
    };

    const clearAll = () => {
        if (confirm('Padamkan semua calon dalam Wishlist?')) {
            setWishlist([]);
            setAnalyzedStocks({});
            localStorage.removeItem('brs_wishlist');
        }
    };

    const runSequentialFilter = async () => {
        if (wishlist.length === 0 || isFiltering) return;

        setIsFiltering(true);
        const updatedResults = { ...analyzedStocks };

        for (const ticker of wishlist) {
            setFilteringTicker(ticker);
            try {
                // Call getLatestPrices for a single ticker to ensure 100% accuracy and one-by-one processing
                const res = await fetch('/.netlify/functions/getLatestPrices', {
                    method: 'POST',
                    body: JSON.stringify({ tickers: [ticker] })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data && data[0]) {
                        updatedResults[ticker] = { ...updatedResults[ticker], ...data[0] };
                        setAnalyzedStocks(prev => ({
                            ...prev,
                            [ticker]: { ...prev[ticker], ...data[0] }
                        }));
                    }
                }
                // Small delay to prevent rate limits and show visual progress
                await new Promise(r => setTimeout(r, 300));
            } catch (e) {
                console.error(`Error filtering ${ticker}:`, e);
            }
        }

        setFilteringTicker(null);
        setIsFiltering(false);
    };

    // Ranking and Filtering View
    const getSortedDisplayList = () => {
        const list = wishlist.map(t => analyzedStocks[t] || { ticker: t, company: 'Loading...', score: 0, loading: true });

        return list
            .filter(s => {
                // If it has been analyzed, remove AVOID
                if (s.verdictLabel === 'AVOID') return false;
                return true;
            })
            .sort((a, b) => {
                const priority = { 'DOUBLE GO': 4, 'GO': 3, 'WAIT': 2, 'MONITOR': 1, 'NEUTRAL': 0 };

                // 1. Verdict Priority
                const vA = a.verdictLabel || 'NEUTRAL';
                const vB = b.verdictLabel || 'NEUTRAL';
                if (priority[vB] !== priority[vA]) return priority[vB] - priority[vA];

                // 2. Alignment Priority for WAIT
                if (vA === 'WAIT' && vB === 'WAIT') {
                    const alignA = a.plan?.multiTimeframe?.confirmedCount || 0;
                    const alignB = b.plan?.multiTimeframe?.confirmedCount || 0;
                    return alignB - alignA;
                }

                // 3. Score
                const scoreA = Math.max(parseFloat(a.score || 0), parseFloat(a.momentumScore || 0));
                const scoreB = Math.max(parseFloat(b.score || 0), parseFloat(b.momentumScore || 0));
                return scoreB - scoreA;
            });
    };

    const displayResults = getSortedDisplayList();

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
                            <div className="p-3 bg-blue-500/10 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                                <Star className="w-8 h-8 text-blue-500 fill-blue-500" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white uppercase">
                                Wishlist <span className="text-gray-500">Intraday</span>
                            </h1>
                        </div>
                        <p className="text-gray-500 mt-2 font-medium">Fokus pada calon terbaik (Score 7-9) untuk tindakan pantas.</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => addHybridStocks('US')}
                            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-full font-bold transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4 text-primary" />
                            Add US Hybrid
                        </button>
                        <button
                            onClick={() => addHybridStocks('Bursa')}
                            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-full font-bold transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4 text-emerald-500" />
                            Add Bursa Hybrid
                        </button>
                        <div className="w-px h-10 bg-white/5 mx-1 hidden md:block"></div>
                        <button
                            onClick={clearAll}
                            className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded-full transition-all"
                            title="Clear All"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Action Bar */}
                <div className="flex flex-col lg:flex-row gap-6 mb-10">
                    <div className="flex-1 bg-surfaceHighlight/20 p-6 rounded-[2rem] border border-border/50 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${isFiltering ? 'bg-primary/20 animate-pulse' : 'bg-primary/10'}`}>
                                <Zap className={`w-6 h-6 ${isFiltering ? 'text-primary animate-bounce' : 'text-primary/50'}`} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg leading-tight">Best of the Best</h3>
                                <p className="text-xs text-gray-500 mt-1">Dapatkan harga & analisis terkini secara satu-persatu.</p>
                            </div>
                        </div>

                        <button
                            onClick={runSequentialFilter}
                            disabled={isFiltering || wishlist.length === 0}
                            className={`
                                flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl
                                ${isFiltering ? 'bg-gray-800 text-gray-600 cursor-wait' : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20 active:scale-95'}
                                ${wishlist.length === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                            `}
                        >
                            {isFiltering ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Filtering... ({filteringTicker})
                                </>
                            ) : (
                                <>
                                    <Activity className="w-5 h-5" />
                                    Filter Best of the Best
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Table Content */}
                {wishlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-surfaceHighlight/5 rounded-[3rem] border border-dashed border-white/10">
                        <div className="p-8 bg-white/5 rounded-full mb-6">
                            <Star className="w-12 h-12 text-gray-800" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Wishlist Masih Kosong</h3>
                        <p className="text-gray-500 max-w-sm text-center">
                            Klik butang "Add Hybrid" di atas untuk memulakan pemantauan saham skor tinggi.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-700">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Senarai Calon</span>
                                <span className="px-2 py-0.5 bg-white/5 rounded-full text-[10px] font-bold text-white border border-white/5">{displayResults.length}</span>
                            </div>
                            {isFiltering && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-primary uppercase animate-pulse">Syncing Live Data...</span>
                                </div>
                            )}
                        </div>

                        <ScreenerTable
                            data={displayResults}
                            onView={setSelectedStock}
                            onToggleFavourite={toggleFavourite}
                            favouriteTickers={favouriteTickers}
                            favouriteDetails={favouriteDetails}
                            positions={positions}
                            activeTab="hybrid"
                            variant="wishlist"
                        />
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
                            setAnalyzedStocks(prev => ({
                                ...prev,
                                [ticker]: { ...prev[ticker], ...updatedStock, isLivePrice: true }
                            }));
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default WishlistPage;
