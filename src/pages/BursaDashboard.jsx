import React, { useState, useEffect } from 'react';
import {
    RefreshCw,
    BarChart2,
    Activity,
    CheckCircle,
    TrendingUp,
    TrendingDown,
    Briefcase,
    Eye,
    Loader2
} from 'lucide-react';
import { useScreener } from '../hooks/useScreener';
import { useFavourites } from '../hooks/useFavourites';
import { usePositions } from '../hooks/usePositions';
import { ScreenerTable } from '../components/ScreenerTable';
import { StockModal } from '../components/StockModal';
import { StockSearch } from '../components/StockSearch';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { PortfolioOverview } from '../components/PortfolioOverview';

function BursaDashboard() {
    const { results, loading, error, lastUpdated, refetch } = useScreener();
    const { favouriteTickers, favouriteDetails, toggleFavourite, toggleAlert } = useFavourites();
    const { positions, addPosition, removePosition, sellPosition } = usePositions();

    const [minScore, setMinScore] = useState("0");
    const [selectedStock, setSelectedStock] = useState(null);
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState('rebound');
    const [systemStats, setSystemStats] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);
    const [livePrices, setLivePrices] = useState({});
    const [localResults, setLocalResults] = useState(null);

    useEffect(() => {
        if (results) setLocalResults(null);
    }, [results]);

    useEffect(() => {
        fetch('/.netlify/functions/systemStatus')
            .then(res => res.json())
            .then(data => {
                if (!data || data.error) return;
                setSystemStats(data);
                // Bursa Market Context
                refetch('universe_myr_real');
            })
            .catch(e => console.error("System Status Fetch Error:", e));
    }, []);

    useEffect(() => {
        // Fetch real-time prices for positions
        const tickers = Object.keys(positions);
        if (tickers.length === 0) return;

        fetch('/.netlify/functions/getLatestPrices', {
            method: 'POST',
            body: JSON.stringify({ tickers })
        })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const newPrices = {};
                    data.forEach(p => {
                        if (p && p.close) {
                            newPrices[p.ticker] = p.close;
                        }
                    });
                    setLivePrices(newPrices);
                }
            })
            .catch(e => console.error("Error fetching live prices for bursa dashboard:", e));
    }, [positions]);

    const syncBursaMaster = async () => {
        setIsSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch('/.netlify/functions/syncBursaMaster');
            const data = await res.json();
            if (data.success) {
                setSyncResult({ ok: true, msg: `✅ ${data.upserted} saham dikemaskini dari The Star.` });
                // Trigger a re-fetch of screener data too
                refetch('shariah_top300_real');
            } else {
                setSyncResult({ ok: false, msg: `❌ Ralat: ${data.error}` });
            }
        } catch (e) {
            setSyncResult({ ok: false, msg: `❌ Gagal: ${e.message}` });
        } finally {
            setIsSyncing(false);
            // Auto-hide result after 8s
            setTimeout(() => setSyncResult(null), 8000);
        }
    };

    const forceRecompute = async () => {
        setIsAnalyzing(true);
        try {
            await fetch(`/.netlify/functions/computeScreener?market=MYR`);
            refetch('shariah_top300_real');
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSelectStock = async (stock, strategy = null) => {
        setSelectedStrategy(strategy);
        if (stock.inScreener) {
            setSelectedStock(stock);
        } else {
            setIsAnalyzing(true);
            try {
                // 1. Ensure history exists
                await fetch('/.netlify/functions/importStockHistory', {
                    method: 'POST',
                    body: JSON.stringify({ ticker: stock.ticker_code || stock.ticker, name: stock.company })
                });

                // 2. Immediate analysis
                const res = await fetch('/.netlify/functions/analyzeStockOnDemand', {
                    method: 'POST',
                    body: JSON.stringify({ ticker: stock.ticker_full || stock.ticker, name: stock.company })
                });
                const found = await res.json();

                if (found && !found.error) {
                    setSelectedStock(found);
                } else {
                    alert(found.error || "Could not analyze this stock at the moment.");
                }
            } catch (err) {
                console.error(err);
                alert("Error analyzing stock.");
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    const rawResults = localResults || (Array.isArray(results) ? results : []);
    const resultsArray = rawResults.filter(s => s && (s.market === 'MYR' || s.market === 'KLSE'));

    const filteredResults = [...resultsArray]
        .filter(stock => {
            // 1. Universal checks
            if (!stock) return false;

            // Allow if it's Top 300, manually added (in portfolio/fav), or has a significant score
            const isOwned = !!positions[stock.ticker];
            const isFav = favouriteTickers.includes(stock.ticker);
            const score = parseFloat(stock.score) || 0;
            const mScore = parseFloat(stock.momentumScore) || 0;
            const isHighScoring = score >= 3 || mScore >= 3;

            // Strict universe filter: Must be Top 300, explicitly in screener, high scoring, owned or fav
            if (!stock.isTop300 && !stock.inScreener && !isHighScoring && !isOwned && !isFav) return false;

            // 2. Shariah Filter (Checks both 'shariah_status' and signals)
            const isShariah = stock.shariah === true ||
                stock.shariah_status === 'SHARIAH' ||
                stock.signals?.includes('SHARIAH') ||
                stock.isShariah === true;
            if (!isShariah) return false;

            // 3. Score Filter
            const scoreToUse = (activeTab === 'momentum' ? (stock.momentumScore || 0) : (stock.score || 0));
            const scoreNum = parseFloat(scoreToUse) || 0;
            if (scoreNum < parseFloat(minScore)) return false;

            // 4. Reject Filter (Hide 'Sikat' or Pump unless Owned/Fav)
            if (stock.rejectReason && !isOwned && !isFav) return false;

            return true;
        })
        .sort((a, b) => {
            const scoreA = parseFloat(activeTab === 'momentum' ? a.momentumScore : a.score) || 0;
            const scoreB = parseFloat(activeTab === 'momentum' ? b.momentumScore : b.score) || 0;
            return scoreB - scoreA;
        });

    // Top Picks
    const topRebound = (resultsArray || [])
        .filter(s => {
            const scoreNum = parseFloat(s.score || 0);
            return s && scoreNum >= 7;
        })
        .sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))[0];

    const topMomentum = (resultsArray || [])
        .filter(s => {
            const scoreNum = parseFloat(s.momentumScore || 0);
            return s && scoreNum >= 8;
        })
        .sort((a, b) => (parseFloat(b.momentumScore) || 0) - (parseFloat(a.momentumScore) || 0))[0];

    // Calculate Portfolio Stats
    const portfolioList = Object.values(positions).map(pos => {
        // For Bursa, we only include stocks that are in the resultsArray (which is already market-filtered)
        const liveStock = resultsArray.find(r => r.ticker === pos.ticker);
        if (!liveStock) return null;

        const currentPrice = livePrices[pos.ticker] || liveStock.close || 0;
        const pl = currentPrice - (pos.entryPrice || 0);
        const plPercent = pos.entryPrice > 0 ? (pl / pos.entryPrice) * 100 : 0;

        return {
            ...pos,
            currentPrice,
            pl,
            plPercent,
            company: liveStock.company,
            fullData: liveStock
        };
    }).filter(p => p && (p.quantity || 0) > 0);

    const totalPositions = portfolioList.length;
    const greenPositions = portfolioList.filter(p => p.pl > 0).length;
    const avgPL = totalPositions > 0 ? portfolioList.reduce((acc, p) => acc + p.plPercent, 0) / totalPositions : 0;

    return (
        <div className="min-h-screen bg-background text-text-primary font-sans p-6 md:p-12 pb-24">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-full uppercase tracking-widest">🇲🇾 Bursa Malaysia Mode</span>
                            <Link to="/" className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-1">
                                ← Back to US 🇺🇸
                            </Link>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 uppercase">
                            BURSA SWING ENGINE
                        </h1>
                        <p className="mt-2 text-gray-500 font-medium">Momentum & Pullback Opportunities in Bursa Malaysia Stocks</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block mr-4">
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Kemaskini Terakhir</div>
                            <div className="text-sm font-mono text-gray-300">
                                {lastUpdated ? format(new Date(lastUpdated), 'dd MMM yyyy, HH:mm') : 'Belum Pernah'}
                            </div>
                        </div>
                        <button
                            onClick={refetch}
                            disabled={loading}
                            className="p-3 bg-primary/10 hover:bg-primary/20 rounded-full transition-all border border-primary/30"
                        >
                            <RefreshCw className={`w-5 h-5 text-primary ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={syncBursaMaster}
                            disabled={isSyncing}
                            title="Ambil senarai terkini saham Bursa dari The Star (semak IPO baru)"
                            className="px-4 py-3 bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-full font-bold text-sm tracking-wide hover:bg-blue-600/30 transition-all flex items-center gap-2"
                        >
                            {isSyncing ? (
                                <><RefreshCw className="w-4 h-4 animate-spin" /> Muat...</>
                            ) : (
                                <><RefreshCw className="w-4 h-4" /> Perbaharui Senarai</>
                            )}
                        </button>
                        <button
                            onClick={forceRecompute}
                            disabled={isAnalyzing}
                            className="px-6 py-3 bg-primary text-white rounded-full font-bold text-sm tracking-wide shadow-lg hover:bg-primary-hover transition-all"
                        >
                            Kira Isyarat Bursa
                        </button>
                    </div>
                </div>
            </div>

            {/* System Status Dashboard */}
            {syncResult && (
                <div className={`max-w-7xl mx-auto mb-4 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${syncResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    {syncResult.msg}
                </div>
            )}
            <SystemBar
                onRecompute={forceRecompute}
                stats={systemStats}
            />


            {/* Main Stats (Top Picks) */}
            <div className="max-w-7xl mx-auto mb-10 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div
                    onClick={() => topRebound && handleSelectStock(topRebound, 'rebound')}
                    className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-[2rem] cursor-pointer hover:border-emerald-500/40 transition-all group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <BarChart2 className="w-24 h-24 text-emerald-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Top Rebound Bursa</div>
                        <h3 className="text-2xl font-black text-white group-hover:text-emerald-400 transition-colors">{topRebound ? topRebound.company : 'Mencari Peluang...'}</h3>
                        {topRebound && (
                            <div className="mt-2 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-emerald-500/20 rounded text-[10px] font-bold text-emerald-400">SKOR: {topRebound.score}</span>
                                <span className="text-[10px] text-gray-500 font-medium">Beli masa pullback.</span>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    onClick={() => topMomentum && handleSelectStock(topMomentum, 'momentum')}
                    className="bg-orange-500/5 border border-orange-500/20 p-6 rounded-[2rem] cursor-pointer hover:border-orange-500/40 transition-all group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <TrendingUp className="w-24 h-24 text-orange-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">Top Momentum Bursa</div>
                        <h3 className="text-2xl font-black text-white group-hover:text-orange-400 transition-colors">{topMomentum ? topMomentum.company : 'Mencari Shark...'}</h3>
                        {topMomentum && (
                            <div className="mt-2 flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-orange-500/20 rounded text-[10px] font-bold text-orange-400">SKOR: {topMomentum.momentumScore}</span>
                                <span className="text-[10px] text-gray-500 font-medium">Breakout sedang berlaku.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Portfolio Summary Card */}
            <PortfolioOverview
                totalPositions={totalPositions}
                avgPL={avgPL}
                greenPositions={greenPositions}
                portfolioList={portfolioList}
                onSelectStock={handleSelectStock}
            />

            {/* Tab Switcher */}
            <div className="max-w-7xl mx-auto mb-6 flex gap-2 p-1 bg-surfaceHighlight/30 rounded-xl border border-border w-fit backdrop-blur-md">
                <button
                    onClick={() => setActiveTab('rebound')}
                    className={`
            flex flex-col items-center gap-0.5 px-8 py-2.5 rounded-lg transition-all
            ${activeTab === 'rebound'
                            ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
          `}
                >
                    <div className="flex items-center gap-2 font-black tracking-tighter text-sm uppercase">
                        <BarChart2 className="w-4 h-4" /> REBOUND
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('momentum')}
                    className={`
            flex flex-col items-center gap-0.5 px-8 py-2.5 rounded-lg transition-all
            ${activeTab === 'momentum'
                            ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
          `}
                >
                    <div className="flex items-center gap-2 font-black tracking-tighter text-sm uppercase">
                        <TrendingUp className="w-4 h-4" /> MOMENTUM
                    </div>
                </button>
            </div>

            {/* Filters Bar */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surfaceHighlight/20 p-5 rounded-[2rem] border border-border/50 shadow-2xl backdrop-blur-sm">
                    <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
                        <div className="flex-1 min-w-[200px]">
                            <StockSearch
                                onSelect={handleSelectStock}
                                screenerResults={resultsArray}
                                activeTab={activeTab}
                                favouriteTickers={favouriteTickers}
                                onToggleFavourite={toggleFavourite}
                                market="MYR"
                            />
                        </div>

                        <div className="h-8 w-px bg-white/5 mx-1 hidden lg:block"></div>

                        <div className="flex-shrink-0 flex items-center gap-3 bg-surface/40 p-1 pl-4 rounded-2xl border border-white/5 whitespace-nowrap">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Min Skor</label>
                            <select
                                value={minScore}
                                onChange={(e) => setMinScore(e.target.value)}
                                className={`
                  text-xs font-bold rounded-xl px-4 py-2 transition-all focus:outline-none appearance-none cursor-pointer pr-10 bg-no-repeat bg-[right_12px_center]
                  ${minScore !== "0" ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surfaceHighlight/50 text-gray-300 border border-white/5'}
                `}
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundSize: '0.8rem' }}
                            >
                                <option value="0">Semua</option>
                                <option value="3.0">3.0+</option>
                                <option value="5.0">5.0+</option>
                                <option value="7.0">7.0+</option>
                                <option value="8.5">8.5+</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-4 px-6 py-3 bg-black/40 rounded-[1.5rem] border border-white/5 shadow-inner">
                            <div className="flex flex-col items-center border-r border-white/10 pr-4">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] mb-1">Alam (Universe)</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-white leading-none tracking-tighter">{resultsArray.length}</span>
                                    <span className="text-[8px] font-bold text-gray-500 uppercase">Saham</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-start pl-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'rebound' ? 'bg-emerald-500' : 'bg-orange-500'} animate-pulse`}></span>
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Saringan {activeTab.toUpperCase()}</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-xl font-black leading-none tracking-tighter ${activeTab === 'rebound' ? 'text-emerald-400' : 'text-orange-400'}`}>
                                        {filteredResults.length}
                                    </span>
                                    <span className="text-[8px] font-bold text-gray-500 uppercase">Calon Lulus</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                <ScreenerTable
                    data={filteredResults}
                    onView={setSelectedStock}
                    onToggleFavourite={toggleFavourite}
                    favouriteTickers={favouriteTickers}
                    favouriteDetails={favouriteDetails}
                    activeTab={activeTab}
                    positions={positions}
                    market="MYR"
                />
            </div>

            {isAnalyzing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
                    <div className="bg-surface p-8 rounded-2xl border border-border shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center border-white/10">
                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                        <h3 className="text-xl font-bold text-white">Tengah Analisa...</h3>
                        <p className="text-sm text-gray-400">Mengambil data sejarah dan mengira isyarat teknik untuk kod ini.</p>
                    </div>
                </div>
            )}

            {selectedStock && (
                <StockModal
                    stock={selectedStock}
                    onClose={() => {
                        setSelectedStock(null);
                        setSelectedStrategy(null);
                    }}
                    strategy={selectedStrategy || activeTab}
                    market="MYR"
                    favouriteTickers={favouriteTickers}
                    favouriteDetails={favouriteDetails}
                    onToggleFavourite={toggleFavourite}
                    onToggleAlert={toggleAlert}
                    positions={positions}
                    onSavePosition={addPosition}
                    onRemovePosition={removePosition}
                    onSellPosition={sellPosition}
                    onStockUpdate={(ticker, updatedStock) => {
                        setLocalResults(prev => {
                            const base = prev || (Array.isArray(results) ? results : []);
                            return base.map(s => {
                                if (s.ticker === ticker) {
                                    return {
                                        ...s,
                                        ...updatedStock,
                                        originalScore: s.originalScore || s.score,
                                        originalMomentumScore: s.originalMomentumScore || s.momentumScore,
                                        isLivePrice: true
                                    };
                                }
                                return s;
                            });
                        });
                        setSelectedStock(prev => prev?.ticker === ticker ? { ...prev, ...updatedStock, isLivePrice: true } : prev);
                    }}
                />
            )}
        </div>
    );
}

const SystemBar = ({ onRecompute, stats }) => {
    if (!stats) return <div className="max-w-7xl mx-auto mb-8 h-12 bg-surface animate-pulse rounded-lg"></div>;

    const { dataMaturity, lastSync } = stats || {};
    if (!dataMaturity) return null;

    const displayedDays = dataMaturity.realDays || 0;

    return (
        <div className={`max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-700`}>
            <div className="bg-surface border border-border rounded-xl p-5 shadow-lg flex flex-col justify-between group overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                    <Activity className="w-16 h-16 text-primary" />
                </div>
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3">Status Enjin Keputusan</span>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <CheckCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-white">AKTIF & STABIL</div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Keputusan Sebenar (OHLCV)</div>
                    </div>
                </div>
                <button
                    onClick={onRecompute}
                    className="mt-4 w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold rounded-lg border border-primary/20 transition-all flex items-center justify-center gap-2 group"
                >
                    <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                    KIRA SEMULA ISYARAT (REAL)
                </button>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-center shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -mr-10 -mt-10 group-hover:bg-blue-500/10 transition-colors"></div>
                <div className="flex justify-between items-end mb-4 relative z-10">
                    <div>
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Kedalaman Data (REAL)</span>
                        <span className="text-2xl font-mono text-white font-bold">{displayedDays}</span>
                        <span className="text-xs text-gray-400 ml-1">HARI DAGANGAN</span>
                    </div>
                </div>
                <div className="space-y-3 relative z-10">
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-medium">
                            <span>MA20 (Trend)</span>
                            <span>{Math.min(displayedDays, 20)}/20</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000 ease-out"
                                style={{ width: `${dataMaturity.realProgressMA20}%` }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-medium">
                            <span>MA50 (Big Trend)</span>
                            <span>{Math.min(displayedDays, 50)}/50</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-1000 ease-out"
                                style={{ width: `${dataMaturity.realProgressMA50}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-center shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 rounded-full -mr-10 -mt-10 group-hover:bg-green-500/10 transition-colors"></div>
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2 block">Imbasan Pasaran (Automasi)</span>
                {lastSync ? (
                    <div className="relative z-10">
                        <div className="text-2xl text-white font-mono font-bold mb-1 tracking-tight">
                            {(() => {
                                if (!lastSync.date) return '-';
                                try {
                                    const d = new Date(lastSync.date);
                                    return `${format(d, 'dd MMM')} ${format(d, 'HH:mm')}`;
                                } catch (e) {
                                    return 'Format Ralat';
                                }
                            })()}
                        </div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wide
                                ${lastSync.status === 'done' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                    lastSync.status === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'}
                            `}>
                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse
                                    ${lastSync.status === 'done' ? 'bg-green-400' :
                                        lastSync.status === 'error' ? 'bg-red-400' :
                                            'bg-blue-400'}
                                `}></div>
                                {lastSync.status === 'done' ? 'SELESAI' :
                                    lastSync.status === 'error' ? 'RALAT' : 'SEDANG BERJALAN'}
                            </span>
                            <span className="text-[11px] text-gray-400 font-bold tracking-tight">
                                {lastSync.status === 'running' ? `${lastSync.count} / ${lastSync.total || '?'}` : lastSync.count} Saham Diproses
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 italic text-sm">
                        <span>Menunggu giliran...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BursaDashboard;
