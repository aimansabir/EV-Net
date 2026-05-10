/**
 * EV-Net — Supabase Client
 * 
 * Single client instance for the entire app.
 * Uses VITE_ env vars which are exposed to the browser by Vite.
 */

import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(value) {
  const trimmed = value?.trim();
  const duplicatedPrefix = 'VITE_SUPABASE_URL=';
  return trimmed?.startsWith(duplicatedPrefix)
    ? trimmed.slice(duplicatedPrefix.length).trim()
    : trimmed;
}

function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[EV-Net] Supabase env vars not set. If using mock mode, this is expected.'
  );
} else if (!isValidHttpUrl(supabaseUrl)) {
  console.warn('[EV-Net] Supabase URL is invalid. Check VITE_SUPABASE_URL.');
}

export const supabase = supabaseUrl && supabaseAnonKey && isValidHttpUrl(supabaseUrl)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
