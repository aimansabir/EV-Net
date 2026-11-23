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

// Every request gets a hard time limit. Without one, a request that stalls on
// a flaky mobile connection never settles and the screen waiting on it shows
// a spinner forever. File uploads get a longer budget than normal API calls.
const API_TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 120000;

function isUploadRequest(input, init) {
  const url = typeof input === 'string' ? input : input?.url || '';
  const method = (init?.method || input?.method || 'GET').toUpperCase();
  return url.includes('/storage/v1/object') && (method === 'POST' || method === 'PUT');
}

function fetchWithTimeout(input, init = {}) {
  const timeoutMs = isUploadRequest(input, init) ? UPLOAD_TIMEOUT_MS : API_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Respect an abort signal supplied by the caller as well.
  const callerSignal = init.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal })
    .catch((err) => {
      if (controller.signal.aborted && !callerSignal?.aborted) {
        throw new Error('The network request timed out. Please check your connection and try again.');
      }
      throw err;
    })
    .finally(() => clearTimeout(timeoutId));
}

export const supabase = supabaseUrl && supabaseAnonKey && isValidHttpUrl(supabaseUrl)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: fetchWithTimeout },
    })
  : null;
