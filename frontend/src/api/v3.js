import axios from "axios";
import config from "../core/config";

const v3 = axios.create({
  baseURL: `${config.backend_url}/api/v3`,
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

// Пошук торентів
export const searchTorrents = async ({ q, title, title_original, year, imdb_id, tmdb_id, media_type }) => {
  const params = { q };
  if (title) params.title = title;
  if (title_original) params.title_original = title_original;
  if (year) params.year = year;
  if (imdb_id) params.imdb_id = imdb_id;
  if (tmdb_id) params.tmdb_id = tmdb_id;
  if (media_type) params.media_type = media_type;
  const res = await v3.get("/stream/search", { params });
  return res.data.results || [];
};

// Додати джерело → отримати файли зі стрім-посиланнями
export const addTorrent = async (magnet, title = "") => {
  const res = await v3.post("/stream/add", { magnet, title });
  return res.data;
};

// Статус завантаження
export const getTorrentStatus = async (hash) => {
  const res = await v3.get(`/stream/status/${hash}`);
  return res.data;
};

// Видалити джерело
export const removeTorrent = async (hash) => {
  await v3.delete(`/stream/remove/${hash}`);
};

// Зберегти прогрес перегляду
export const saveProgress = async ({ user_id, movie_id, position_seconds, duration, season, episode }) => {
  const res = await v3.post("/watch/progress", {
    user_id, movie_id, position_seconds, duration, season, episode,
  });
  return res.data;
};

// Отримати прогрес перегляду
export const getProgress = async (user_id, movie_id, season = null, episode = null) => {
  const res = await v3.get("/watch/progress", {
    params: { user_id, movie_id, season, episode },
  });
  return res.data;
};

// Історія переглядів
export const getWatchHistory = async (user_id, limit = 50) => {
  const res = await v3.get("/watch/history", { params: { user_id, limit } });
  return res.data;
};
