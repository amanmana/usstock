import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, ListFilter, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function StockSearch({ onSelect, screenerResults, favouriteTickers = [], onToggleFavourite }) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Filter screener results locally first
    const safeResults = Array.isArray(screenerResults) ? screenerResults : [];
    const localMatches = safeResults.filter(s =>
        (s.ticker || '').toLowerCase().includes(query.toLowerCase()) ||
        (s.company || '').toLowerCase().includes(query.toLowerCase()) ||
        (s.short_name && s.short_name.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, 5);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = async (val) => {
        setQuery(val);
        if (val.length < 2) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        setIsOpen(true);

        try {
            // 1. Start with local screener results (priority)
            const screenerMatches = safeResults.filter(s =>
                (s.ticker || '').toLowerCase().includes(val.toLowerCase()) ||
                (s.company || '').toLowerCase().includes(val.toLowerCase()) ||
                (s.short_name && s.short_name.toLowerCase().includes(val.toLowerCase()))
            ).map(s => ({ ...s, ticker_full: s.ticker, inScreener: true }));

            // 2. Search global database for missing ones
            const { data: globalMatches, error } = await supabase
                .from('klse_stocks')
                .select('ticker_code, company_name, ticker_full, short_name')
                .or(`ticker_code.ilike.%${val}%,company_name.ilike.%${val}%,short_name.ilike.%${val}%`)
                .limit(10);

            if (error) throw error;

            // Merge and de-duplicate
            const results = [...screenerMatches];
            const screenerTickers = new Set(screenerMatches.map(s => s.ticker));

            globalMatches?.forEach(g => {
                const fullTicker = g.ticker_full;
                if (!screenerTickers.has(fullTicker)) {
                    results.push({
                        ticker: g.ticker_code,
                        company: g.company_name,
                        ticker_full: fullTicker,
                        inScreener: false,
                        // Dummy data for non-screener stocks
                        score: '-',
                        close: 0,
                        stats: {},
                        signals: []
                    });
                }
            });

            setSuggestions(results.slice(0, 8));
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative w-full max-w-sm" ref={dropdownRef}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                    placeholder="Search ticker or company..."
                    className="w-full bg-surfaceHighlight border border-border text-white text-sm rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                )}
            </div>

            {isOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="max-h-[350px] overflow-y-auto">
                        {suggestions.map((stock) => {
                            const isFav = favouriteTickers.includes(stock.ticker) || favouriteTickers.includes(stock.ticker_full);

                            return (
                                <div
                                    key={stock.ticker}
                                    className="w-full flex items-center group transition-colors border-b border-border/50 last:border-0 hover:bg-white/5"
                                >
                                    <button
                                        onClick={() => {
                                            onSelect(stock);
                                            setIsOpen(false);
                                            setQuery('');
                                        }}
                                        className="flex-1 text-left px-4 py-3 flex items-center justify-between"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                                                {stock.company}
                                            </span>
                                            <span className="text-xs text-gray-500 font-mono tracking-wider">{stock.ticker}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {stock.inScreener ? (
                                                <div className="text-right">
                                                    <div className="text-[10px] text-primary font-bold uppercase tracking-tighter mb-0.5">Screener Result</div>
                                                    <div className="text-xs font-mono text-gray-300">Score: {stock.score}</div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">Database Only</span>
                                            )}
                                        </div>
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleFavourite(stock.ticker_full || `${stock.ticker}.KL`);
                                        }}
                                        className={`p-4 transition-colors group/heart ${isFav ? 'text-red-500' : 'text-gray-600 hover:text-red-400'}`}
                                        title={isFav ? "Remove from Favourites" : "Add to Favourites"}
                                    >
                                        <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : 'group-hover/heart:scale-110 transition-transform'}`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {isOpen && query.length >= 2 && !loading && suggestions.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl p-4 text-center text-sm text-gray-500 z-50">
                    No matching stocks found
                </div>
            )}
        </div>
    );
}
