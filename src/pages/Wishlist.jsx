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
import { supabase } from '../lib/supabase';

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
    const [activeMenu, setActiveMenu] = useState('Wishlist');
    const [marketTab, setMarketTab] = useState('Bursa');

    const { favouriteTickers, favouriteDetails, toggleFavourite, toggleAlert } = useFavourites();
    const { positions, addPosition, removePosition, sellPosition } = usePositions();

    // Persistence
    useEffect(() => {
        localStorage.setItem('brs_wishlist', JSON.stringify(wishlist));
    }, [wishlist]);

    const [allResults, setAllResults] = useState([]);

    // Force fetch all data once to have hybrid candidates ready
    useEffect(() => {
        const loadUniverses = async () => {
            try {
                // Fetch US results
                const { data: usData } = await supabase
                    .from('screener_results_cache')
                    .select('results_json')
                    .eq('universe', 'universe_us_real')
                    .order('as_of_date', { ascending: false })
                    .limit(1)
                    .single();

                // Fetch Bursa results
                const { data: myrData } = await supabase
                    .from('screener_results_cache')
                    .select('results_json')
                    .eq('universe', 'universe_myr_real')
                    .order('as_of_date', { ascending: false })
                    .limit(1)
                    .single();

                const combined = [
                    ...(usData?.results_json || []),
                    ...(myrData?.results_json || [])
                ];

                setAllResults(combined);
            } catch (e) {
                console.error("Error loading universes for Wishlist:", e);
                // Fallback to the hook's results if something fails
                if (results && results.length > 0) setAllResults(results);
            }
        };

        loadUniverses();
    }, [results]);

    const addHybridStocks = (market) => {
        const sourceData = allResults.length > 0 ? allResults : (results || []);
        if (sourceData.length === 0) return;

        // Filter Score 7-10
        const candidates = sourceData.filter(s => {
            if (!s) return false;

            // Market Filter
            const isBursa = s.market === 'MYR' || s.market === 'KLSE' || s.ticker?.endsWith('.KL');
            if (market === 'US' && isBursa) return false;
            if (market === 'Bursa' && !isBursa) return false;

            // Score Filter (from Hybrid logic)
            const scoreNum = Math.max(
                parseFloat(s.score || 0),
                parseFloat(s.momentumScore || 0),
                parseFloat(s.snapshotScore10 || 0)
            );

            return scoreNum >= 7.0 && scoreNum <= 10.0;
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

    const clearMarket = () => {
        const type = marketTab === 'US' ? 'US' : 'Bursa';
        if (confirm(`Padamkan semua calon ${type} dalam Wishlist?`)) {
            const listToRemove = marketTab === 'US' ? usResults : bursaResults;
            const tickersToRemove = listToRemove.map(s => s.ticker);

            const newWishlist = wishlist.filter(t => !tickersToRemove.includes(t));
            setWishlist(newWishlist);

            const newAnalyzed = { ...analyzedStocks };
            tickersToRemove.forEach(t => delete newAnalyzed[t]);
            setAnalyzedStocks(newAnalyzed);

            // If we're on a certain tab and it becomes empty, the persistent storage updates via useEffect
        }
    };

    const getSortedDisplayList = () => {
        return wishlist
            .map(ticker => {
                const resultsSource = allResults.length > 0 ? allResults : (results || []);
                const found = resultsSource.find(r => r.ticker === ticker);
                const analyzed = analyzedStocks[ticker];

                if (found || analyzed) {
                    return {
                        ...(found || {}),
                        ...(analyzed || {}),
                        ticker // ensure ticker is preserved
                    };
                }
                return { ticker, isPending: true };
            })
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
                const scoreA = Math.max(parseFloat(a.score || 0), parseFloat(a.momentumScore || 0), parseFloat(a.snapshotScore10 || 0));
                const scoreB = Math.max(parseFloat(b.score || 0), parseFloat(b.momentumScore || 0), parseFloat(b.snapshotScore10 || 0));
                return scoreB - scoreA;
            });
    };

    const displayResults = getSortedDisplayList();
    const bursaResults = displayResults.filter(s => s.market === 'MYR' || s.market === 'KLSE' || s.ticker?.endsWith('.KL'));
    const usResults = displayResults.filter(s => !(s.market === 'MYR' || s.market === 'KLSE' || s.ticker?.endsWith('.KL')));
    const activeResults = marketTab === 'Bursa' ? bursaResults : usResults;

    const runSequentialFilter = async () => {
        const targetTickers = activeResults.map(s => s.ticker);
        if (targetTickers.length === 0 || isFiltering) return;

        setIsFiltering(true);
        const updatedResults = { ...analyzedStocks };

        for (const ticker of targetTickers) {
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


    return (
        <div className="min-h-screen bg-background text-text-primary font-sans p-6 md:p-12 pb-24">
            <div className="max-w-7xl mx-auto">
                {/* Modern Header */}
                <div className="mb-12">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-gray-500 hover:text-white transition-all mb-6 group text-xs font-black uppercase tracking-[0.2em]"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Market
                    </button>

                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse"></div>
                            <div className="relative p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl shadow-2xl">
                                <Star className="w-8 h-8 text-blue-500 fill-blue-500/20" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white uppercase leading-none">
                                Wishlist <span className="text-gray-600">Intraday</span>
                            </h1>
                            <p className="text-gray-500 mt-2 font-bold text-sm tracking-wide italic">
                                Fokus pada calon terbaik (Score 7-9) untuk tindakan pantas.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-8 mb-12">
                    {/* Market Toggle & Actions Row */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex bg-surfaceHighlight/30 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                            <button
                                onClick={() => setMarketTab('US')}
                                className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${marketTab === 'US' ? 'bg-primary text-white shadow-[0_0_30px_rgba(59,130,246,0.5)]' : 'text-gray-500 hover:text-white'}`}
                            >
                                US Stock ({usResults.length})
                            </button>
                            <button
                                onClick={() => setMarketTab('Bursa')}
                                className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${marketTab === 'Bursa' ? 'bg-primary text-white shadow-[0_0_30px_rgba(59,130,246,0.5)]' : 'text-gray-500 hover:text-white'}`}
                            >
                                Bursa Stock ({bursaResults.length})
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => addHybridStocks(marketTab)}
                                className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl font-bold transition-all active:scale-95 group"
                            >
                                <Plus className={`w-4 h-4 transition-transform group-hover:rotate-90 ${marketTab === 'US' ? 'text-primary' : 'text-emerald-500'}`} />
                                Add {marketTab} Hybrid
                            </button>
                            <div className="w-px h-8 bg-white/5 mx-1"></div>
                            <button
                                onClick={clearMarket}
                                className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-500/5"
                                title={`Clear ${marketTab} List`}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Best of the Best Filter Section */}
                    <div className="bg-surfaceHighlight/20 p-8 rounded-[2.5rem] border border-border/40 flex flex-col lg:flex-row items-center justify-between gap-8 backdrop-blur-sm relative overflow-hidden group shadow-2xl">
                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 transition-colors group-hover:bg-primary/10"></div>

                        <div className="flex items-center gap-6 relative z-10">
                            <div className={`p-5 rounded-[1.5rem] ${isFiltering ? 'bg-primary/20 animate-pulse ring-4 ring-primary/10' : 'bg-primary/10 transition-colors group-hover:bg-primary/15'}`}>
                                <Zap className={`w-8 h-8 ${isFiltering ? 'text-primary animate-bounce' : 'text-primary/60 group-hover:text-primary'}`} />
                            </div>
                            <div>
                                <h3 className="text-white font-black text-2xl tracking-tight">Best of the Best</h3>
                                <p className="text-gray-400 mt-1 font-medium leading-relaxed max-w-md">
                                    Dapatkan harga & analisis terkini satu-persatu untuk filter counter terbaik <span className="text-primary font-bold uppercase">{marketTab}</span>.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={runSequentialFilter}
                            disabled={isFiltering || activeResults.length === 0}
                            className={`
                                relative z-10 flex items-center gap-4 px-12 py-5 rounded-2xl font-black text-base uppercase tracking-[0.1em] transition-all duration-300 shadow-2xl
                                ${isFiltering ? 'bg-gray-800 text-gray-500 cursor-wait' : 'bg-primary hover:bg-primary/90 text-white shadow-primary/40 active:scale-[0.98] hover:-translate-y-1'}
                                ${activeResults.length === 0 ? 'opacity-40 grayscale cursor-not-allowed' : ''}
                            `}
                        >
                            {isFiltering ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Filtering {marketTab}...
                                </>
                            ) : (
                                <>
                                    <Activity className="w-6 h-6" />
                                    Filter {marketTab} Now
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Table Content */}
                {activeResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-surfaceHighlight/5 rounded-[3rem] border border-dashed border-white/10">
                        <div className="p-8 bg-white/5 rounded-full mb-6">
                            <Star className="w-12 h-12 text-gray-800" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Tiada Saham {marketTab}</h3>
                        <p className="text-gray-500 max-w-sm text-center">
                            Klik butang "Add Hybrid" di atas untuk memulakan pemantauan saham skor tinggi.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {isFiltering && (
                            <div className="flex items-center justify-end px-4">
                                <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
                                    <span className="text-[10px] font-black text-primary uppercase tracking-tighter">Syncing Live Data: {filteringTicker}</span>
                                </div>
                            </div>
                        )}

                        <ScreenerTable
                            data={activeResults}
                            onView={setSelectedStock}
                            onToggleFavourite={toggleFavourite}
                            favouriteTickers={favouriteTickers}
                            favouriteDetails={favouriteDetails}
                            positions={positions}
                            activeTab="hybrid"
                            market={marketTab === 'Bursa' ? 'KLSE' : 'USD'}
                            variant="wishlist"
                            analyzingTicker={filteringTicker}
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
