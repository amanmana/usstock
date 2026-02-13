import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'screener_positions';

export function usePositions() {
    const [positions, setPositions] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchPositions = useCallback(async () => {
        try {
            const res = await fetch('/.netlify/functions/listPositions');
            if (res.ok) {
                const data = await res.json();
                // Map from DB (snake_case) to UI (camelCase)
                const mapped = data.reduce((acc, pos) => {
                    acc[pos.ticker_full] = {
                        ticker: pos.ticker_full,
                        entryPrice: pos.entry_price,
                        strategy: pos.strategy,
                        quantity: pos.quantity,
                        stopLoss: pos.stop_loss,
                        targetPrice: pos.target_price,
                        maxRisk: pos.max_risk,
                        buyDate: pos.buy_date,
                        updatedAt: pos.updated_at
                    };
                    return acc;
                }, {});
                setPositions(mapped);
            }
        } catch (err) {
            console.error("Error fetching positions:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // One-time migration from localStorage to DB
    useEffect(() => {
        const migrate = async () => {
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    const tickers = Object.keys(parsed);

                    if (tickers.length > 0) {
                        console.log(`Migrating ${tickers.length} positions to DB...`);
                        for (const ticker of tickers) {
                            const pos = parsed[ticker];
                            await fetch('/.netlify/functions/savePosition', {
                                method: 'POST',
                                body: JSON.stringify({
                                    ticker_full: ticker,
                                    entry_price: pos.entryPrice,
                                    strategy: pos.strategy,
                                    quantity: pos.quantity,
                                    stop_loss: pos.stopLoss,
                                    target_price: pos.targetPrice,
                                    max_risk: pos.maxRisk,
                                    buy_date: pos.buyDate
                                })
                            });
                        }
                    }
                    // Clear local storage after successful migration trigger
                    localStorage.removeItem(STORAGE_KEY);
                    fetchPositions();
                } catch (e) {
                    console.error("Migration failed", e);
                }
            } else {
                fetchPositions();
            }
        };

        migrate();
    }, [fetchPositions]);

    const addPosition = async (ticker, data) => {
        // Optimistic update
        setPositions(prev => ({
            ...prev,
            [ticker]: { ...data, ticker, updatedAt: new Date().toISOString() }
        }));

        try {
            const res = await fetch('/.netlify/functions/savePosition', {
                method: 'POST',
                body: JSON.stringify({
                    ticker_full: ticker,
                    entry_price: data.entryPrice,
                    strategy: data.strategy,
                    quantity: data.quantity,
                    stop_loss: data.stopLoss,
                    target_price: data.targetPrice,
                    max_risk: data.maxRisk,
                    buy_date: data.buyDate
                })
            });
            if (!res.ok) throw new Error("Failed to save");
            fetchPositions(); // Sync with real DB state
        } catch (err) {
            console.error(err);
            fetchPositions(); // Revert on failure
        }
    };

    const removePosition = async (ticker) => {
        // Optimistic delete
        setPositions(prev => {
            const newPos = { ...prev };
            delete newPos[ticker];
            return newPos;
        });

        try {
            const res = await fetch('/.netlify/functions/removePosition', {
                method: 'POST',
                body: JSON.stringify({ ticker_full: ticker })
            });
            if (!res.ok) throw new Error("Failed to remove");
            fetchPositions();
        } catch (err) {
            console.error(err);
            fetchPositions();
        }
    };

    const getPosition = (ticker) => positions[ticker];

    return {
        positions,
        loading,
        addPosition,
        removePosition,
        getPosition
    };
}
