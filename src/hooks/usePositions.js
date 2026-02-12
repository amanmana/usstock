import { useState, useEffect } from 'react';

const STORAGE_KEY = 'screener_positions';

export function usePositions() {
    const [positions, setPositions] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error("Corrupted positions in localStorage", e);
            return {};
        }
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    }, [positions]);

    const addPosition = (ticker, data) => {
        setPositions(prev => ({
            ...prev,
            [ticker]: {
                ...data,
                ticker,
                updatedAt: new Date().toISOString()
            }
        }));
    };

    const removePosition = (ticker) => {
        setPositions(prev => {
            const newPos = { ...prev };
            delete newPos[ticker];
            return newPos;
        });
    };

    const getPosition = (ticker) => positions[ticker];

    return {
        positions,
        addPosition,
        removePosition,
        getPosition
    };
}
