/**
 * EV-Net — Supabase Client
 * 
 * Single client instance for the entire app.
 * Uses VITE_ env vars which are exposed to the browser by Vite.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[EV-Net] Supabase env vars not set. If using mock mode, this is expected.'
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
