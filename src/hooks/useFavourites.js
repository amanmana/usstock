import { useState, useEffect } from 'react';

export function useFavourites() {
    const [favouriteTickers, setFavouriteTickers] = useState([]);
    const [loadingFavs, setLoadingFavs] = useState(true);

    const fetchFavourites = async () => {
        try {
            const res = await fetch('/.netlify/functions/listFavourites');
            if (res.ok) {
                const data = await res.json();
                setFavouriteTickers(data || []);
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
        loadingFavs,
        toggleFavourite,
        addCustomFavourite,
        refreshFavourites: fetchFavourites
    };
}
