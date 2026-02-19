import { useState, useEffect, useCallback } from 'react';

export function useTradeHistory() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch('/.netlify/functions/listTradeHistory');
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (err) {
            console.error("Error fetching history:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const deleteTrade = async (id) => {
        try {
            const res = await fetch('/.netlify/functions/deleteTrade', {
                method: 'POST',
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                setHistory(prev => prev.filter(t => t.id !== id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const updateTrade = async (id, data) => {
        try {
            const res = await fetch('/.netlify/functions/updateTrade', {
                method: 'POST',
                body: JSON.stringify({ id, ...data })
            });
            if (res.ok) {
                const updated = await res.json();
                setHistory(prev => prev.map(t => t.id === id ? updated : t));
                return updated;
            }
        } catch (err) {
            console.error(err);
        }
    };

    return {
        history,
        loading,
        fetchHistory,
        deleteTrade,
        updateTrade
    };
}
