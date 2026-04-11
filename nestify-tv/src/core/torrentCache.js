const CACHE_TTL = 3 * 60 * 1000; // 3 хвилини
const cache = new Map();

export function getCachedTorrents(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedTorrents(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

export function makeTorrentCacheKey({ tmdbId, mediaType, title }) {
  return `${tmdbId}:${mediaType}:${title || ""}`;
}
