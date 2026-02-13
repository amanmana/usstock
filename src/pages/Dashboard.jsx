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
  const { favouriteTickers, toggleFavourite } = useFavourites();
  const { positions, addPosition, removePosition } = usePositions();

  const [minScore, setMinScore] = useState("0");
  const [shariahOnly, setShariahOnly] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dataMode, setDataMode] = useState('hybrid');
  const [systemStats, setSystemStats] = useState(null);
  const [activeTab, setActiveTab] = useState('rebound'); // 'rebound' or 'momentum'

  useEffect(() => {
    // Fetch system status & handle auto-mode-switch
    fetch('/.netlify/functions/systemStatus')
      .then(res => res.json())
      .then(data => {
        if (!data || data.error) return;
        setSystemStats(data);
        // If data is mature (>= 50 days), force PRODUCTION mode
        if (data.dataMaturity && data.dataMaturity.realDays >= 50) {
          setDataMode('real');
          // Important: Trigger refetch for the real data universe
          refetch('shariah_top300_real');
        }
      })
      .catch(e => console.error("System Status Fetch Error:", e));
  }, []);

  const handleModeToggle = async (mode) => {
    setDataMode(mode);
    refetch(mode === 'real' ? 'shariah_top300_real' : 'shariah_top300_hybrid');
  };

  const forceRecompute = async () => {
    setIsAnalyzing(true);
    try {
      await fetch(`/.netlify/functions/computeScreener?useMock=${dataMode === 'hybrid'}`);
      refetch(dataMode === 'real' ? 'shariah_top300_real' : 'shariah_top300_hybrid');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // MAIN LIST RULE: Filter and Sort based on active tab
  const resultsArray = Array.isArray(results) ? results : [];
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
      const scoreToUse = (activeTab === 'momentum' ? stock.momentumScore : (stock.score || 0));
      const scoreNum = parseFloat(scoreToUse) || 0;
      if (scoreNum < parseFloat(minScore)) return false;

      // 4. Reject Filter (Hide 'Sikat' / Pump unless Owned/Fav)
      const isOwned = !!positions[stock.ticker];
      const isFavourited = favouriteTickers.includes(stock.ticker);
      if (stock.rejectReason && !isOwned && !isFavourited) return false;

      return true;
    })
    .sort((a, b) => {
      const scoreA = parseFloat(activeTab === 'momentum' ? a.momentumScore : a.score) || 0;
      const scoreB = parseFloat(activeTab === 'momentum' ? b.momentumScore : b.score) || 0;
      return scoreB - scoreA;
    });

  // Calculate Portfolio Stats
  const portfolioList = resultsArray.length > 0 ? Object.values(positions).map(pos => {
    const liveStock = resultsArray.find(r => r.ticker === pos.ticker);
    if (!liveStock) return null;
    const currentPrice = liveStock.close || 0;
    const pl = currentPrice - (pos.entryPrice || 0);
    const plPercent = pos.entryPrice > 0 ? (pl / pos.entryPrice) * 100 : 0;
    return { ...pos, currentPrice, pl, plPercent, company: liveStock.company, fullData: liveStock };
  }).filter(Boolean) : [];

  const totalPositions = portfolioList.length;
  const greenPositions = portfolioList.filter(p => p.pl > 0).length;
  const avgPL = totalPositions > 0 ? portfolioList.reduce((acc, p) => acc + p.plPercent, 0) / totalPositions : 0;

  // Calculate Top Picks
  const topRebound = (resultsArray || [])
    .filter(s => s && s.score >= 7 && (shariahOnly ? (s.shariah || s.signals?.includes('SHARIAH')) : true))
    .sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))[0];

  const topMomentum = (resultsArray || [])
    .filter(s => s && s.momentumScore >= 8 && (shariahOnly ? (s.shariah || s.signals?.includes('SHARIAH')) : true))
    .sort((a, b) => (parseFloat(b.momentumScore) || 0) - (parseFloat(a.momentumScore) || 0))[0];

  const handleSync = () => {
    if (confirm('Start EOD Sync? This may take a few minutes.')) {
      startSync();
    }
  };

  const handleSelectStock = async (stock) => {
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
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              SCREENER REBOUND
            </h1>
            <p className="mt-2 text-gray-500 font-medium">Peluang Momentum & Pullback di Bursa Malaysia</p>
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
        mode={dataMode}
        onToggleMode={handleModeToggle}
        onRecompute={forceRecompute}
        stats={systemStats}
      />

      {/* Quick Recommendations (Top Picks) */}
      <div className="max-w-7xl mx-auto mb-10 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Rebound Pick */}
        <div
          onClick={() => topRebound && handleSelectStock(topRebound)}
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
          onClick={() => topMomentum && handleSelectStock(topMomentum)}
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
                  {avgPL.toFixed(2)}%
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
                    {pos.plPercent >= 0 ? '+' : ''}{pos.plPercent.toFixed(1)}%
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
      </div>

      {/* Filters Bar */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-wrap items-center gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
          <button
            onClick={() => setShariahOnly(!shariahOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border ${shariahOnly ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-surfaceHighlight border-transparent text-gray-400 hover:text-white'}`}
          >
            <span className={`w-2 h-2 rounded-full ${shariahOnly ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`}></span>
            <span className="text-sm font-semibold">Patuh Syariah</span>
          </button>

          <div className="h-8 w-px bg-border mx-2"></div>
          <StockSearch
            onSelect={handleSelectStock}
            screenerResults={resultsArray}
            favouriteTickers={favouriteTickers}
            onToggleFavourite={toggleFavourite}
          />
          <div className="h-8 w-px bg-border mx-2"></div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-400">Min Score:</label>
            <select
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className={`
                text-sm font-bold rounded-lg px-4 py-2 border transition-all focus:ring-2 focus:ring-primary focus:outline-none appearance-none cursor-pointer pr-10 bg-no-repeat bg-[right_12px_center]
                ${minScore !== "0" ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-surfaceHighlight border-border text-white'}
              `}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundSize: '1.25rem' }}
            >
              <option value="0">Semua Skor</option>
              <option value="3.0">3.0+ (Watchlist)</option>
              <option value="5.0">5.0+ (Berpotensi)</option>
              <option value="7.0">7.0+ (Setup Kuat)</option>
              <option value="8.5">8.5+ (Pilihan Utama)</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-500">
            Strategi <span className="text-white font-bold uppercase">{activeTab}</span>: <span className="text-white font-bold">{filteredResults.length}</span> calon
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
          onClose={() => setSelectedStock(null)}
          favouriteTickers={favouriteTickers}
          onToggleFavourite={toggleFavourite}
          positions={positions}
          onSavePosition={addPosition}
          onRemovePosition={removePosition}
        />
      )}
    </div>
  );
}

const SystemBar = ({ mode, onToggleMode, onRecompute, stats }) => {
  if (!stats) return <div className="max-w-7xl mx-auto mb-8 h-12 bg-surface animate-pulse rounded-lg"></div>;

  const { dataMaturity, lastSync } = stats || {};
  if (!dataMaturity) return null;
  const isReal = mode === 'real';
  const displayedDays = isReal ? (dataMaturity.realDays || 0) : (dataMaturity.totalDays || 0);
  const isMature = (dataMaturity.realDays || 0) >= 50;

  return (
    <div className={`max-w-7xl mx-auto mb-8 grid grid-cols-1 ${isMature ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-6`}>
      {/* 0. Data Source Toggle (Auto-Hides when mature) */}
      {!isMature && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3">Sistem Data</span>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onToggleMode('hybrid')}
              className={`text-xs px-3 py-2 rounded-lg font-bold border transition-all flex items-center justify-between ${!isReal ? 'bg-primary/20 border-primary text-primary' : 'bg-surfaceHighlight border-transparent text-gray-500 hover:text-white'}`}
            >
              DEMO (DATA PALSU)
              {!isReal && <div className="w-1.5 h-1.5 rounded-full bg-primary mx-1"></div>}
            </button>
            <button
              onClick={() => onToggleMode('real')}
              className={`text-xs px-3 py-2 rounded-lg font-bold border transition-all flex items-center justify-between ${isReal ? 'bg-orange-500/20 border-orange-500 text-orange-500' : 'bg-surfaceHighlight border-transparent text-gray-500 hover:text-white'}`}
            >
              ASAL (DATA SEBENAR)
              {isReal && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mx-1"></div>}
            </button>
          </div>
          <button
            onClick={onRecompute}
            className="mt-4 w-full py-2 bg-surfaceHighlight hover:bg-white/10 text-[11px] text-white font-bold rounded-lg border border-border transition-all flex items-center justify-center gap-2 group"
          >
            <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
            KIRA SEMULA ISYARAT
          </button>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-center shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -mr-10 -mt-10 group-hover:bg-blue-500/10 transition-colors"></div>
        <div className="flex justify-between items-end mb-4 relative z-10">
          <div>
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Kedalaman Data ({mode.toUpperCase()})</span>
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
                style={{ width: `${isReal ? dataMaturity.realProgressMA20 : dataMaturity.progressMA20}%` }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-medium">
              <span>MA50 (Big Trend)</span>
              <span>{Math.min(displayedDays, 50)}/50</span>
            </div>
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-1000 ease-out"
                style={{ width: `${isReal ? dataMaturity.realProgressMA50 : dataMaturity.progressMA50}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-center shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 rounded-full -mr-10 -mt-10 group-hover:bg-green-500/10 transition-colors"></div>
        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2 block">Auto-Sync Terakhir (Cron)</span>
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
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 uppercase tracking-wide">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                Selesai
              </span>
              <span className="text-xs text-gray-400 font-medium">{lastSync.count} Saham Diproses</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 italic text-sm">
            <span>Menunggu giliran...</span>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -mr-10 -mt-10"></div>
        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3">Status Sistem</span>
        <div className="flex-1 flex items-center">
          <div className="text-sm text-gray-300 leading-relaxed font-medium">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0 text-emerald-500">✔</div>
              <div>
                <span className="text-emerald-400 block font-bold mb-1">Beroperasi Penuh</span>
                Semua penunjuk trend aktif.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
