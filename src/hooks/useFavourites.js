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
                setFavouriteTickers(data.map(f => f.ticker_full) || []);
                const details = {};
                data.forEach(f => {
                    details[f.ticker_full] = f;
                });
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
                fetchFavourites();
            } else {
                const data = await res.json();
                // Sync with server state
                setFavouriteTickers(prev => {
                    const others = prev.filter(t => t !== symbol);
                    return data.is_active ? [...others, symbol] : others;
                });
                if (data.is_active) {
                    setFavouriteDetails(prev => ({ ...prev, [symbol]: data }));
                } else {
                    setFavouriteDetails(prev => {
                        const next = { ...prev };
                        delete next[symbol];
                        return next;
                    });
                }
            }
        } catch (err) {
            console.error(err);
            fetchFavourites();
        }
    };

    const toggleAlert = async (symbol, enabled) => {
        // Optimistic UI update
        setFavouriteDetails(prev => ({
            ...prev,
            [symbol]: { ...prev[symbol], alert_enabled: enabled }
        }));

        try {
            const res = await fetch('/.netlify/functions/toggleAlert', {
                method: 'POST',
                body: JSON.stringify({ symbol, enabled })
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
