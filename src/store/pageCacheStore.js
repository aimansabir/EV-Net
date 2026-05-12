import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const PAGE_CACHE_TTL = {
  SHORT: 2 * 60 * 1000,
  MEDIUM: 3 * 60 * 1000,
  LONG: 5 * 60 * 1000,
};

const pageCache = new Map();
const inflightRequests = new Map();

const hasValue = (value) => value !== undefined && value !== null;

export function makePageCacheKey(...parts) {
  return parts
    .filter(part => part !== undefined && part !== null && part !== '')
    .map(part => String(part))
    .join(':');
}

export function getPageCacheEntry(key) {
  return key ? pageCache.get(key) || null : null;
}

export function getPageCacheData(key) {
  return getPageCacheEntry(key)?.data;
}

export function setPageCacheData(key, data) {
  if (!key) return data;
  pageCache.set(key, {
    data,
    updatedAt: Date.now(),
    error: null,
  });
  return data;
}

export function patchPageCacheData(key, updater) {
  const entry = getPageCacheEntry(key);
  const current = entry?.data;
  const next = typeof updater === 'function' ? updater(current) : updater;
  setPageCacheData(key, next);
  return next;
}

export function invalidatePageCache(keyOrPrefix) {
  if (!keyOrPrefix) {
    pageCache.clear();
    return;
  }

  const prefix = String(keyOrPrefix);
  for (const key of pageCache.keys()) {
    if (key === prefix || key.startsWith(`${prefix}:`)) {
      pageCache.delete(key);
    }
  }
}

export function invalidatePageCaches(keysOrPrefixes = []) {
  keysOrPrefixes.forEach(invalidatePageCache);
}

export function isPageCacheStale(key, ttl = PAGE_CACHE_TTL.MEDIUM) {
  const entry = getPageCacheEntry(key);
  if (!entry) return true;
  return Date.now() - entry.updatedAt >= ttl;
}

async function fetchWithCache(key, fetcher, { force = false, ttl = PAGE_CACHE_TTL.MEDIUM } = {}) {
  const entry = getPageCacheEntry(key);
  const isFresh = entry && Date.now() - entry.updatedAt < ttl;

  if (!force && isFresh) {
    return entry.data;
  }

  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const request = Promise.resolve()
    .then(fetcher)
    .then(data => setPageCacheData(key, data))
    .catch(error => {
      const previous = getPageCacheEntry(key);
      if (previous) {
        pageCache.set(key, {
          ...previous,
          error,
          lastErrorAt: Date.now(),
        });
      }
      throw error;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, request);
  return request;
}

export function useCachedPageData(key, fetcher, options = {}) {
  const {
    ttl = PAGE_CACHE_TTL.MEDIUM,
    enabled = true,
    initialData = null,
    keepPreviousData = true,
    refreshOnMount = 'stale',
  } = options;

  const initialState = useMemo(() => {
    const entry = getPageCacheEntry(key);
    const data = hasValue(entry?.data) ? entry.data : initialData;
    return {
      data,
      isLoading: enabled && !hasValue(data),
      isRefreshing: false,
      error: entry?.error || null,
      updatedAt: entry?.updatedAt || 0,
    };
  }, [enabled, initialData, key]);

  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const setData = useCallback((updater) => {
    setState(prev => {
      const nextData = typeof updater === 'function' ? updater(prev.data) : updater;
      setPageCacheData(key, nextData);
      return {
        ...prev,
        data: nextData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        updatedAt: Date.now(),
      };
    });
  }, [key]);

  const refresh = useCallback(async ({ force = true, silent } = {}) => {
    if (!key || !enabled) {
      setState(prev => ({ ...prev, isLoading: false, isRefreshing: false }));
      return null;
    }

    const entry = getPageCacheEntry(key);
    const currentData = hasValue(entry?.data)
      ? entry.data
      : (keepPreviousData ? stateRef.current.data : initialData);
    const hasData = hasValue(currentData);
    const useSilentState = silent ?? hasData;

    setState(prev => ({
      ...prev,
      data: hasData ? currentData : prev.data,
      isLoading: !useSilentState && !hasData,
      isRefreshing: useSilentState,
      error: null,
    }));

    try {
      const data = await fetchWithCache(key, () => fetcherRef.current(), { force, ttl });
      setState({
        data,
        isLoading: false,
        isRefreshing: false,
        error: null,
        updatedAt: Date.now(),
      });
      return data;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error,
      }));
      return null;
    }
  }, [enabled, initialData, keepPreviousData, key, ttl]);

  useEffect(() => {
    if (!key || !enabled) {
      setState(prev => ({ ...prev, isLoading: false, isRefreshing: false }));
      return;
    }

    const entry = getPageCacheEntry(key);
    if (hasValue(entry?.data)) {
      const stale = Date.now() - entry.updatedAt >= ttl;
      setState({
        data: entry.data,
        isLoading: false,
        isRefreshing: false,
        error: entry.error || null,
        updatedAt: entry.updatedAt,
      });

      if (refreshOnMount === 'always' || (refreshOnMount === 'stale' && stale)) {
        refresh({ force: true, silent: true });
      }
      return;
    }

    setState(initialState);
    refresh({ force: true, silent: false });
  }, [enabled, initialState, key, refresh, refreshOnMount, ttl]);

  return {
    ...state,
    isStale: key ? isPageCacheStale(key, ttl) : true,
    refresh,
    setData,
  };
}
