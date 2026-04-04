import { saveProgress as v3Save, getProgress as v3Get } from "../v3";

/**
 * Парсить movie_id у { mediaType, tmdbId } або null якщо не tmdb формат.
 * Формати: "tmdb_movie_123", "tmdb_tv_123"
 */
function parseTmdbMovieId(movie_id) {
  if (!movie_id) return null;
  const str = String(movie_id);
  const match = str.match(/^tmdb_(movie|tv)_(\d+)$/);
  if (match) return { mediaType: match[1], tmdbId: match[2] };
  return null;
}

/** GET progress — повертає { position_seconds } */
export const getProgress = async ({ user_id, movie_id, season, episode }) => {
  try {
    return await v3Get(user_id, String(movie_id), season, episode);
  } catch {
    return { position_seconds: 0 };
  }
};

/** POST/PUT progress */
export const saveProgress = ({ user_id, movie_id, position_seconds, duration, season, episode }) => {
  if (!user_id || !movie_id) return Promise.resolve();
  return v3Save({
    user_id,
    movie_id: String(movie_id),
    position_seconds: Math.floor(position_seconds || 0),
    duration: duration ? Math.floor(duration) : null,
    season: season || null,
    episode: episode || null,
  }).catch(console.error);
};

export { parseTmdbMovieId };
