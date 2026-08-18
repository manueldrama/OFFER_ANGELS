import { createClient } from '@supabase/supabase-js';

let supabaseUrl = '';
let supabaseAnonKey = '';

try {
    // @ts-ignore
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    // @ts-ignore
    supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
} catch (e) {
    if (typeof process !== 'undefined' && process.env) {
        supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    }
}

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[Supabase]: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
        'Service functions will run in MOCK mode until these are configured.'
    );
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder_anon_key'
);
