import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
        console.error('Supabase configuration error: Missing environment variables.');
    }
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
);
