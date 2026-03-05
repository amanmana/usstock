import { useState, useEffect } from 'react';

export function useFavourites() {
    const [favouriteTickers, setFavouriteTickers] = useState([]);
    const [favouriteDetails, setFavouriteDetails] = useState({}); // Map of ticker -> detail object
    const [loadingFavs, setLoadingFavs] = useState(true);

    const fetchFavourites = async () => {
        try {
            const res = await fetch('/.netlify/functions/listFavourites');
            if (res.ok) {
                const data = await res.json();

                // Tickers that will be used for state matching (highlights, etc)
                const tickers = new Set();
                const details = {};

                data.forEach(f => {
                    const market = f.market || (f.ticker_full?.endsWith('.KL') ? 'MYR' : 'US');
                    const isBursa = market === 'MYR' || market === 'KLSE';

                    if (f.ticker_full) {
                        tickers.add(f.ticker_full);
                        details[f.ticker_full] = f;
                    }

                    if (f.ticker_code) {
                        tickers.add(f.ticker_code);
                        details[f.ticker_code] = f;
                        if (isBursa) {
                            const klTicker = f.ticker_code.endsWith('.KL') ? f.ticker_code : `${f.ticker_code}.KL`;
                            tickers.add(klTicker);
                            details[klTicker] = f;
                        }
                    }

                    if (f.short_name) {
                        tickers.add(f.short_name);
                        details[f.short_name] = f;
                        if (isBursa) {
                            const klTicker = f.short_name.endsWith('.KL') ? f.short_name : `${f.short_name}.KL`;
                            tickers.add(klTicker);
                            details[klTicker] = f;
                        }
                    }
                });

                setFavouriteTickers(Array.from(tickers));
                setFavouriteDetails(details);
            }
        } catch (err) {
            console.error("Error fetching favourites:", err);
        } finally {
            setLoadingFavs(false);
        }
    };

    const toggleFavourite = async (symbol) => {
        // Optimistic UI update
        const isCurrentlyFav = favouriteTickers.includes(symbol);
        setFavouriteTickers(prev =>
            isCurrentlyFav
                ? prev.filter(t => t !== symbol)
                : [...prev, symbol]
        );

        try {
            const res = await fetch('/.netlify/functions/toggleFavourite', {
                method: 'POST',
                body: JSON.stringify({ symbol })
            });

            if (!res.ok) {
                // Revert on error
                setTimeout(fetchFavourites, 500); // Slight delay for DB to settle
            } else {
                const data = await res.json();
                const canonical = data.ticker_full;

                // Sync with server state
                setFavouriteTickers(prev => {
                    const others = prev.filter(t => t !== symbol && t !== canonical);
                    if (data.is_active) {
                        return [...others, symbol, canonical];
                    }
                    return others;
                });

                if (data.is_active) {
                    setFavouriteDetails(prev => ({
                        ...prev,
                        [symbol]: data,
                        [canonical]: data
                    }));
                } else {
                    setFavouriteDetails(prev => {
                        const next = { ...prev };
                        delete next[symbol];
                        delete next[canonical];
                        return next;
                    });
                }
            }
        } catch (err) {
            console.error(err);
            fetchFavourites();
        }
    };

    const toggleAlert = async (symbol, enabled, settings = null) => {
        // Optimistic UI update
        setFavouriteDetails(prev => ({
            ...prev,
            [symbol]: settings
                ? { ...prev[symbol], ...settings, alert_enabled: settings.alert_go || settings.alert_tp || settings.alert_sl }
                : { ...prev[symbol], alert_enabled: enabled, alert_go: enabled }
        }));

        try {
            const res = await fetch('/.netlify/functions/toggleAlert', {
                method: 'POST',
                body: JSON.stringify({ symbol, enabled, settings })
            });
            if (!res.ok) {
                fetchFavourites();
            } else {
                const data = await res.json();
                setFavouriteDetails(prev => ({ ...prev, [symbol]: data }));
            }
        } catch (err) {
            console.error(err);
            fetchFavourites();
        }
    };

    const addCustomFavourite = async (symbol) => {
        try {
            const res = await fetch('/.netlify/functions/addCustomFavourite', {
                method: 'POST',
                body: JSON.stringify({ symbol })
            });
            if (res.ok) {
                const data = await res.json();
                if (!favouriteTickers.includes(data.ticker)) {
                    setFavouriteTickers(prev => [...prev, data.ticker]);
                }
                fetchFavourites(); // Get full details
                return { success: true, ticker: data.ticker };
            }
            return { success: false };
        } catch (err) {
            console.error(err);
            return { success: false };
        }
    };

    useEffect(() => {
        fetchFavourites();
    }, []);

    return {
        favouriteTickers,
        favouriteDetails,
        loadingFavs,
        toggleFavourite,
        toggleAlert,
        addCustomFavourite,
        refreshFavourites: fetchFavourites
    };
}
