import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  BarChart2,
  ExternalLink,
  X,
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Users,
  Heart,
  Briefcase,
  TrendingDown,
  Eye,
  Activity,
  Book
} from 'lucide-react';
import { useScreener } from '../hooks/useScreener';
import { useSync } from '../hooks/useSync';
import { useFavourites } from '../hooks/useFavourites';
import { usePositions } from '../hooks/usePositions';
import { ScreenerTable } from '../components/ScreenerTable';
import { StockModal } from '../components/StockModal';
import { StockSearch } from '../components/StockSearch';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

function Dashboard() {
  const { results, loading, error, lastUpdated, refetch } = useScreener();
  const { startSync, status: syncStatus, progress, total, messages } = useSync();
  const { favouriteTickers, favouriteDetails, toggleFavourite, toggleAlert } = useFavourites();
  const { positions, addPosition, removePosition, sellPosition } = usePositions();

  const [minScore, setMinScore] = useState("0");
  const [shariahOnly] = useState(true); // Forced true for Shariah-only US system
  const [selectedStock, setSelectedStock] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dataMode, setDataMode] = useState('real');
  const [systemStats, setSystemStats] = useState(null);
  const [activeTab, setActiveTab] = useState('rebound'); // 'rebound' or 'momentum'
  const [livePrices, setLivePrices] = useState({});
  const [localResults, setLocalResults] = useState(null);

  useEffect(() => {
    // Reset local results when fresh screener data comes in from hook
    if (results) setLocalResults(null);
  }, [results]);

  useEffect(() => {
    // Fetch system status
    fetch('/.netlify/functions/systemStatus')
      .then(res => res.json())
      .then(data => {
        if (!data || data.error) return;
        setSystemStats(data);
        // Force production universe
        refetch('shariah_top300_real');
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
            // We map ticker explicitly to its close 
            if (p && p.close) {
              newPrices[p.ticker] = p.close;
            }
          });
          setLivePrices(newPrices);
        }
      })
      .catch(e => console.error("Error fetching live prices for dashboard:", e));
  }, [positions]);

  const handleModeToggle = async (mode) => {
    // This function is now a no-op as we enforce 'real'
    setDataMode('real');
    refetch('shariah_top300_real');
  };

  const forceRecompute = async () => {
    setIsAnalyzing(true);
    try {
      await fetch(`/.netlify/functions/computeScreener?useMock=false`);
      refetch('shariah_top300_real');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // MAIN LIST RULE: Filter and Sort based on active tab
  const rawResults = localResults || (Array.isArray(results) ? results : []);
  const resultsArray = rawResults.filter(s => s && s.market !== 'MYR' && s.market !== 'KLSE');

  const filteredResults = [...resultsArray]
    .filter(stock => {
      // 1. Universal checks
      if (!stock) return false;

      // Allow if it's Top 300, manually added, or has a significant score
      const score = parseFloat(stock.score) || 0;
      const mScore = parseFloat(stock.momentumScore) || 0;
      const isHighScoring = score >= 3 || mScore >= 3;

      if (!stock.isTop300 && !stock.inScreener && !isHighScoring) return false;

      // 2. Shariah Filter (Checks both 'shariah' property and signals)
      if (shariahOnly) {
        const isShariah = stock.shariah === true ||
          stock.signals?.includes('SHARIAH') ||
          stock.isShariah === true;
        if (!isShariah) return false;
      }

      // 3. Score Filter
      const isHybrid = activeTab === 'hybrid';
      const scoreToUse = isHybrid
        ? Math.max(parseFloat(stock.momentumScore) || 0, parseFloat(stock.score) || 0)
        : (activeTab === 'momentum' ? stock.momentumScore : (stock.score || 0));
      const scoreNum = parseFloat(scoreToUse) || 0;
      if (scoreNum < parseFloat(minScore)) return false;

      // 4. Reject Filter (Hide 'Sikat' / Pump unless Owned/Fav)
      const isStockOwnedByUser = !!positions[stock.ticker];
      const isFavourited = favouriteTickers.includes(stock.ticker);
      if (stock.rejectReason && !isStockOwnedByUser && !isFavourited) return false;

      return true;
    })
    .sort((a, b) => {
      const isHybrid = activeTab === 'hybrid';
      const scoreA = isHybrid
        ? Math.max(parseFloat(a.momentumScore) || 0, parseFloat(a.score) || 0)
        : parseFloat(activeTab === 'momentum' ? a.momentumScore : a.score) || 0;
      const scoreB = isHybrid
        ? Math.max(parseFloat(b.momentumScore) || 0, parseFloat(b.score) || 0)
        : parseFloat(activeTab === 'momentum' ? b.momentumScore : b.score) || 0;
      return scoreB - scoreA;
    });

  // Calculate Portfolio Stats
  const portfolioList = resultsArray.length > 0 ? Object.values(positions).map(pos => {
    const liveStock = resultsArray.find(r => r.ticker === pos.ticker);
    if (!liveStock) return null;
    const currentPrice = livePrices[pos.ticker] || liveStock.close || 0;
    const pl = currentPrice - (pos.entryPrice || 0);
    const plPercent = pos.entryPrice > 0 ? (pl / pos.entryPrice) * 100 : 0;
    return { ...pos, currentPrice, pl, plPercent, company: liveStock.company, fullData: liveStock };
  }).filter(Boolean) : [];

  const totalPositions = portfolioList.length;
  const greenPositions = portfolioList.filter(p => p.pl > 0).length;
  const avgPL = totalPositions > 0 ? portfolioList.reduce((acc, p) => acc + p.plPercent, 0) / totalPositions : 0;

  // Calculate Top Picks
  const topRebound = (resultsArray || [])
    .filter(s => {
      const scoreNum = parseFloat(s.score || 0);
      return s && scoreNum >= 7 && (shariahOnly ? (s.shariah || s.isShariah || s.signals?.includes('SHARIAH')) : true);
    })
    .sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))[0];

  const topMomentum = (resultsArray || [])
    .filter(s => {
      const scoreNum = parseFloat(s.momentumScore || 0);
      return s && scoreNum >= 8 && (shariahOnly ? (s.shariah || s.isShariah || s.signals?.includes('SHARIAH')) : true);
    })
    .sort((a, b) => (parseFloat(b.momentumScore) || 0) - (parseFloat(a.momentumScore) || 0))[0];

  const handleSync = () => {
    if (confirm('Start EOD Sync? This may take a few minutes.')) {
      startSync();
    }
  };

  const handleSelectStock = async (stock, strategy = null) => {
    // Preserve the strategy if forced (e.g. from Top Pick card)
    setSelectedStrategy(strategy);

    if (stock.inScreener) {
      setSelectedStock(stock);
    } else {
      setIsAnalyzing(true);
      try {
        // 1. First ensure we have price history for this stock
        await fetch('/.netlify/functions/importStockHistory', {
          method: 'POST',
          body: JSON.stringify({ ticker: stock.ticker_code || stock.ticker, name: stock.company })
        });

        // 2. Then get the instant analysis for only this stock
        const res = await fetch('/.netlify/functions/analyzeStockOnDemand', {
          method: 'POST',
          body: JSON.stringify({ ticker: stock.ticker_full || stock.ticker, name: stock.company })
        });
        const found = await res.json();

        if (found && !found.error) {
          setSelectedStock(found);
          // Optional: Recompute universe in background so it appears in the table next time
          fetch('/.netlify/functions/computeScreener');
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

  const isMature = systemStats?.dataMaturity?.realDays >= 50;

  return (
    <div className="min-h-screen bg-background text-text-primary font-sans p-6 md:p-12 pb-24">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 uppercase">
              SHARIAH US SCREENER
            </h1>
            <p className="mt-2 text-gray-500 font-medium">Momentum & Pullback Opportunities in Global Shariah Market</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Kemaskini Terakhir</div>
              <div className="text-sm font-mono text-gray-300">
                {(() => {
                  try {
                    return lastUpdated ? format(new Date(lastUpdated), 'dd MMM yyyy, HH:mm') : 'Belum Pernah';
                  } catch (e) {
                    return 'Format Ralat';
                  }
                })()}
              </div>
            </div>

            {/* If mature, show Recalculate button here instead of the Environment card */}
            {isMature && (
              <button
                onClick={forceRecompute}
                disabled={isAnalyzing}
                className="p-3 bg-orange-500/10 hover:bg-orange-500/20 rounded-full transition-all border border-orange-500/30 outline-none focus:ring-2 focus:ring-orange-500/50"
                title="Kira Semula Isyarat (Manual Refresh)"
              >
                <RefreshCw className={`w-5 h-5 text-orange-500 ${isAnalyzing ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={refetch}
              disabled={loading}
              className="p-3 bg-primary/10 hover:bg-primary/20 rounded-full transition-all border border-primary/30 outline-none focus:ring-2 focus:ring-primary/50"
              title="Kemaskini Paparan Jadual"
            >
              <RefreshCw className={`w-5 h-5 text-primary ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleSync}
              disabled={syncStatus === 'running' || syncStatus === 'computing'}
              className={`
                 flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm tracking-wide transition-all shadow-lg
                 ${syncStatus === 'running' || syncStatus === 'computing' ? 'bg-yellow-500/20 text-yellow-500 cursor-not-allowed border border-yellow-500/30' : 'bg-primary hover:bg-primary-hover text-white border border-transparent shadow-primary/20'}
              `}
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus === 'running' || syncStatus === 'computing' ? 'animate-spin' : ''}`} />
              {syncStatus === 'running' ? `Tengah Sync (${progress}/${total})` :
                syncStatus === 'computing' ? 'Tengah Kira...' : 'Sync Data EOD'}
            </button>
          </div>
        </div>
      </div>

      {/* System Status Dashboard */}
      <SystemBar
        onRecompute={forceRecompute}
        stats={systemStats}
      />

      {/* Quick Recommendations (Top Picks) */}
      <div className="max-w-7xl mx-auto mb-10 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Rebound Pick */}
        <div
          onClick={() => topRebound && handleSelectStock(topRebound, 'rebound')}
          className={`
            relative overflow-hidden group cursor-pointer p-6 rounded-[2rem] border transition-all duration-500 hover:scale-[1.02] active:scale-95
            ${topRebound ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 shadow-2xl shadow-emerald-500/10' : 'bg-surface/50 border-border opacity-50'}
          `}
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <BarChart2 className="w-24 h-24 text-emerald-500" />
          </div>
          <div className="relative z-10 flex items-start gap-4">
            <div className="p-3 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] rounded-2xl">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black tracking-[0.2em] text-emerald-400 uppercase">Top Rebound</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <h3 className="text-2xl font-black text-white leading-tight">
                {topRebound ? topRebound.company : 'Mencari Peluang...'}
              </h3>
              {topRebound && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-md text-[10px] font-bold text-emerald-400">
                    SKOR: {topRebound.score}
                  </div>
                  <div className="text-xs text-gray-400 font-medium">Beli masa pullback. Potensi reversal kuat.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Momentum Pick */}
        <div
          onClick={() => topMomentum && handleSelectStock(topMomentum, 'momentum')}
          className={`
            relative overflow-hidden group cursor-pointer p-6 rounded-[2rem] border transition-all duration-500 hover:scale-[1.02] active:scale-95
            ${topMomentum ? 'bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40 shadow-2xl shadow-orange-500/10' : 'bg-surface/50 border-border opacity-50'}
          `}
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <TrendingUp className="w-24 h-24 text-orange-500" />
          </div>
          <div className="relative z-10 flex items-start gap-4">
            <div className="p-3 bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)] rounded-2xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black tracking-[0.2em] text-orange-400 uppercase">Top Momentum</span>
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse"></span>
              </div>
              <h3 className="text-2xl font-black text-white leading-tight">
                {topMomentum ? topMomentum.company : 'Mencari Shark...'}
              </h3>
              {topMomentum && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="px-2 py-1 bg-orange-500/20 border border-orange-500/30 rounded-md text-[10px] font-bold text-orange-400">
                    SKOR: {topMomentum.momentumScore}
                  </div>
                  <div className="text-xs text-gray-400 font-medium">Breakout sedang berlaku. Ikut trend!</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Overview Bar */}
      {totalPositions > 0 && (
        <div className="max-w-7xl mx-auto mb-8 animate-in slide-in-from-top duration-500">
          <div className="bg-gradient-to-r from-surfaceHighlight/50 to-surfaceHighlight/20 border border-border rounded-2xl p-4 flex flex-wrap items-center gap-6 shadow-xl">
            <div className="flex items-center gap-3 pr-6 border-r border-border/50">
              <div className="p-2.5 bg-primary/20 rounded-xl">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Portfolio Saya</div>
                <div className="text-sm font-bold text-white">{totalPositions} Saham Pegangan</div>
              </div>
            </div>

            <div className="flex items-center gap-8 flex-1">
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Purata P/L</div>
                <div className={`text-lg font-black flex items-center gap-2 ${avgPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {avgPL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {Number(avgPL).toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Status</div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold text-gray-300">{greenPositions} Untung</span>
                  <span className="text-gray-600 mx-1">/</span>
                  <span className="text-xs font-bold text-gray-500">{totalPositions - greenPositions} Rugi</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 flex-wrap ml-auto py-1">
              {portfolioList.map(pos => (
                <button
                  key={pos.ticker}
                  onClick={() => handleSelectStock(pos.fullData)}
                  className={`
                        px-3 py-1.5 rounded-lg border text-[10px] font-black transition-all hover:scale-105 active:scale-95
                        ${pos.pl >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                      : 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]'}
                      `}
                >
                  {pos.company}
                  <span className="block text-[8px] opacity-70">
                    {pos.plPercent >= 0 ? '+' : ''}{Number(pos.plPercent).toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
          <span className={`text-[9px] font-bold opacity-70 uppercase ${activeTab === 'rebound' ? 'text-white' : ''}`}>
            Buy the Dip / Reversal
          </span>
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
          <span className={`text-[9px] font-bold opacity-70 uppercase ${activeTab === 'momentum' ? 'text-white' : ''}`}>
            Breakout / Trend Follow
          </span>
        </button>
        <button
          onClick={() => setActiveTab('hybrid')}
          className={`
            flex flex-col items-center gap-0.5 px-8 py-2.5 rounded-lg transition-all
            ${activeTab === 'hybrid'
              ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
          `}
        >
          <div className="flex items-center gap-2 font-black tracking-tighter text-sm uppercase">
            <Activity className="w-4 h-4" /> HYBRID
          </div>
          <span className={`text-[9px] font-bold opacity-70 uppercase ${activeTab === 'hybrid' ? 'text-white' : ''}`}>
            Best of Both Worlds
          </span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surfaceHighlight/20 p-5 rounded-[2rem] border border-border/50 shadow-2xl backdrop-blur-sm">

          {/* Left Side: Controls - Expanded to fill space */}
          <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
            {/* Shariah toggle removed as per request - forced true */}

            <div className="h-8 w-px bg-white/5 mx-1 hidden lg:block"></div>

            {/* Search Field - Takes up remaining space */}
            <div className="flex-1 min-w-[200px]">
              <StockSearch
                onSelect={handleSelectStock}
                screenerResults={resultsArray}
                activeTab={activeTab}
                favouriteTickers={favouriteTickers}
                onToggleFavourite={toggleFavourite}
                market="USD"
              />
            </div>

            <div className="h-8 w-px bg-white/5 mx-1 hidden lg:block"></div>

            {/* Min Skor - Pushed to the right of Search */}
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

          {/* Right Side: Stats Badges */}
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {error ? (
          <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-center">
            Error loading data: {error}
          </div>
        ) : loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-surface rounded-xl w-full"></div>
            ))}
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border border-border dashed rounded-xl bg-surface/50 border-white/5">
            <div className="p-4 bg-surfaceHighlight rounded-full mb-4">
              <Eye className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white">Tiada keputusan dijumpai</h3>
            <p className="text-gray-400 mt-2 max-w-sm mx-auto">
              Strategi <span className="text-white font-bold">{activeTab.toUpperCase()}</span> mungkin belum dikira atau skor terlalu rendah.
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={() => setMinScore("0")}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-all text-xs font-bold uppercase tracking-widest"
              >
                Tengok Semua Skor
              </button>
              <button
                onClick={forceRecompute}
                className="px-6 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg border border-primary/30 transition-all text-xs font-bold uppercase tracking-widest"
              >
                Kira Semula Isyarat
              </button>
            </div>
          </div>
        ) : (
          <ScreenerTable
            data={filteredResults}
            onView={setSelectedStock}
            onToggleFavourite={toggleFavourite}
            favouriteTickers={favouriteTickers}
            favouriteDetails={favouriteDetails}
            activeTab={activeTab}
            positions={positions}
          />
        )}
      </div>

      {/* On-demand Analysis Loader */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-surface p-8 rounded-2xl border border-border shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center border-white/10">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h3 className="text-xl font-bold text-white">Tengah Analisa...</h3>
            <p className="text-sm text-gray-400">Mengambil data sejarah dan mengira isyarat teknik untuk kod ini.</p>
          </div>
        </div>
      )}

      {/* Sync Logs */}
      {(syncStatus === 'running' || syncStatus === 'computing' || messages.length > 0) && (
        <div className="fixed bottom-12 right-6 w-96 bg-surface border border-border rounded-xl shadow-2xl p-4 z-50">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sync Activity</h4>
            {syncStatus === 'idle' && (
              <button onClick={() => window.location.reload()} className="text-[10px] text-primary hover:underline">Clear Logs</button>
            )}
          </div>
          <div className="bg-background rounded-lg p-3 font-mono text-[10px] text-gray-400 h-40 overflow-y-auto space-y-1">
            {messages.map((msg, i) => (
              <div key={i} className="border-b border-white/5 pb-1 last:border-0">{msg}</div>
            ))}
            {syncStatus === 'running' && (
              <div className="animate-pulse text-primary font-bold">Imbasan pasaran sedang berjalan...</div>
            )}
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

  const isReal = true;
  const displayedDays = dataMaturity.realDays || 0;

  return (
    <div className={`max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-700`}>
      {/* 1. System Health Bar */}
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

export default Dashboard;
