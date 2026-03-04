import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export function useScreener() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchResults = async (targetUniverse = 'shariah_top300_real') => {
        setLoading(true);
        setError(null);
        try {
            // Get the latest screener result for the specified universe
            const { data, error } = await supabase
                .from('screener_results_cache')
                .select('*')
                .eq('universe', targetUniverse)
                .order('as_of_date', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // No rows found
                    setResults([]);
                    setLastUpdated(null);
                } else {
                    throw error;
                }
            } else if (data) {
                if (data.results_json && Array.isArray(data.results_json)) {
                    setResults(data.results_json);
                    setLastUpdated(new Date(data.created_at));
                } else {
                    setResults([]);
                }
            }
        } catch (err) {
            console.error('Error fetching screener results:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResults();
    }, []);

    return { results, loading, error, lastUpdated, refetch: fetchResults };
}
