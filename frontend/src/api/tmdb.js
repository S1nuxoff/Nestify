import axios from "axios";
import config from "../core/config";

const tmdb = axios.create({
  baseURL: config.tmdb_base,
  params: { api_key: config.tmdb_key, language: "uk-UA" },
  timeout: 10000,
});

export const tmdbImg = (path, size = "w500") =>
  path ? `${config.tmdb_img}/${size}${path}` : null;

export const tmdbImgOriginal = (path) =>
  path ? `${config.tmdb_img}/original${path}` : null;

// Trending — головна сторінка
export const getTrending = async (timeWindow = "week") => {
  const res = await tmdb.get(`/trending/all/${timeWindow}`);
  return res.data.results || [];
};

// Популярні фільми
export const getPopularMovies = async () => {
  const res = await tmdb.get("/movie/popular");
  return res.data.results || [];
};

// Популярні серіали
export const getPopularTv = async () => {
  const res = await tmdb.get("/tv/popular");
  return res.data.results || [];
};

// Зараз в кіно
export const getNowPlaying = async () => {
  const res = await tmdb.get("/movie/now_playing");
  return res.data.results || [];
};

// Пошук
export const searchTmdb = async (query) => {
  const res = await tmdb.get("/search/multi", {
    params: { query, include_adult: false },
  });
  return (res.data.results || []).filter(
    (r) => r.media_type === "movie" || r.media_type === "tv"
  );
};

// Деталі фільму
export const getMovieDetails = async (tmdbId) => {
  const res = await tmdb.get(`/movie/${tmdbId}`, {
    params: { append_to_response: "credits,videos" },
  });
  return res.data;
};

// Деталі серіалу
export const getTvDetails = async (tmdbId) => {
  const res = await tmdb.get(`/tv/${tmdbId}`, {
    params: { append_to_response: "credits,videos" },
  });
  return res.data;
};

// Сезон серіалу
export const getTvSeason = async (tmdbId, seasonNumber) => {
  const res = await tmdb.get(`/tv/${tmdbId}/season/${seasonNumber}`);
  return res.data;
};

// Discover — фільтрована вибірка
export const discover = async (mediaType = "movie", params = {}, page = 1) => {
  const res = await tmdb.get(`/discover/${mediaType}`, {
    params: { sort_by: "popularity.desc", page, ...params },
  });
  return {
    results: res.data.results || [],
    total_pages: res.data.total_pages || 1,
    page: res.data.page || 1,
  };
};

// Топ рейтинг
export const getTopRated = async (mediaType = "movie") => {
  const res = await tmdb.get(`/${mediaType}/top_rated`);
  return res.data.results || [];
};

// Зараз в ефірі (серіали)
export const getOnTheAir = async () => {
  const res = await tmdb.get("/tv/on_the_air");
  return res.data.results || [];
};

// Рекомендації для фільму або серіалу
export const getRecommendations = async (tmdbId, mediaType = "movie") => {
  const res = await tmdb.get(`/${mediaType}/${tmdbId}/recommendations`);
  return (res.data.results || []).slice(0, 20);
};

// Відео (трейлери) для фільму або серіалу
export const getVideos = async (tmdbId, mediaType = "movie") => {
  const res = await tmdb.get(`/${mediaType}/${tmdbId}/videos`);
  return res.data.results || [];
};

// Нормалізація TMDB item у формат FeaturedCard / MediaCard
export function normalizeTmdbItem(item) {
  const mediaType = item.media_type || "movie";
  const title = item.title || item.name || "";
  const originName = item.original_title || item.original_name || "";
  const releaseDate = (item.release_date || item.first_air_date || "").slice(0, 4);
  const genres = (item.genres || item.genre_ids || [])
    .filter((g) => typeof g === "string")
    .slice(0, 2);

  return {
    id: item.id,
    tmdbId: item.id,
    mediaType,
    title,
    filmName: title,
    origin_name: originName !== title ? originName : null,
    description: item.overview || "",
    rate: item.vote_average ? item.vote_average.toFixed(1) : null,
    release_date: releaseDate,
    duration: null,
    genre: genres,
    age: item.adult ? "18+" : null,
    image: tmdbImg(item.poster_path, "w342"),
    filmImage: tmdbImg(item.poster_path, "w342"),
    poster_tmdb: tmdbImg(item.poster_path, "w500"),
    backdrop: tmdbImg(item.backdrop_path, "w1280"),
    backdrop_url_original: `https://image.tmdb.org/t/p/original${item.backdrop_path}`,
    logo_url: null,
    trailer_tmdb: null, // заповнюється окремо через getVideos
    type: mediaType === "tv" ? "series" : "film",
    filmDecribe: releaseDate,
    _isTmdb: true,
  };
}
