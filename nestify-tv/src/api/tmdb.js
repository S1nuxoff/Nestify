import axios from "axios";
import config from "../core/config";

const tmdb = axios.create({
  baseURL: config.tmdb_base,
  params: { api_key: config.tmdb_key, language: "uk-UA" },
  timeout: 10000,
});

export const tmdbImg = (path, size = "w500") =>
  path ? `${config.tmdb_img}/${size}${path}` : null;

export const tmdbBackdrop = (path, size = "w1280") =>
  path ? `${config.tmdb_img}/${size}${path}` : null;

export const tmdbImgOriginal = (path) =>
  path ? `${config.tmdb_img}/original${path}` : null;

export const pickTmdbLogo = (logos = []) => {
  if (!Array.isArray(logos) || logos.length === 0) return null;

  const sorted = [...logos].sort((a, b) => {
    const aLangPriority =
      a.iso_639_1 === "uk" ? 0 : a.iso_639_1 === "en" ? 1 : 2;
    const bLangPriority =
      b.iso_639_1 === "uk" ? 0 : b.iso_639_1 === "en" ? 1 : 2;

    if (aLangPriority !== bLangPriority) {
      return aLangPriority - bLangPriority;
    }

    return (b.vote_average || 0) - (a.vote_average || 0);
  });

  return tmdbImgOriginal(sorted[0]?.file_path || null);
};

// Trending — головна сторінка
export const getTrending = async (timeWindow = "week") => {
  const res = await tmdb.get(`/trending/all/${timeWindow}`);
  return res.data.results || [];
};

// Популярне за місяць — discover з датою 30 днів
export const getMonthlyTrending = async (mediaType = "all") => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  const since = date.toISOString().split("T")[0];
  const types = mediaType === "all" ? ["movie", "tv"] : [mediaType];
  const dateKey = mediaType === "tv" ? "first_air_date.gte" : "primary_release_date.gte";

  if (mediaType === "all") {
    const [movies, tv] = await Promise.all([
      tmdb.get("/discover/movie", { params: { sort_by: "popularity.desc", "primary_release_date.gte": since } }),
      tmdb.get("/discover/tv",    { params: { sort_by: "popularity.desc", "first_air_date.gte": since } }),
    ]);
    return [
      ...(movies.data.results || []).map(i => ({ ...i, media_type: "movie" })),
      ...(tv.data.results    || []).map(i => ({ ...i, media_type: "tv" })),
    ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
  }

  const res = await tmdb.get(`/discover/${mediaType}`, {
    params: { sort_by: "popularity.desc", [dateKey]: since },
  });
  return (res.data.results || []).map(i => ({ ...i, media_type: mediaType }));
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

// Пошук (фільми + серіали)
export const searchTmdb = async (query) => {
  const res = await tmdb.get("/search/multi", {
    params: { query, include_adult: false },
  });
  return (res.data.results || []).filter(
    (r) => r.media_type === "movie" || r.media_type === "tv"
  );
};

// Пошук з персонами
export const searchTmdbMulti = async (query) => {
  const res = await tmdb.get("/search/multi", {
    params: { query, include_adult: false },
  });
  return res.data.results || [];
};

// Деталі фільму
export const getMovieDetails = async (tmdbId) => {
  const res = await tmdb.get(`/movie/${tmdbId}`, {
    params: {
      append_to_response: "credits,videos,images,reviews",
      include_image_language: "uk,en,null",
    },
  });
  return res.data;
};

// Англійська назва (для не-латинських оригінальних назв)
export const getTitleInEnglish = async (tmdbId, mediaType = "movie") => {
  try {
    const endpoint = mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
    const res = await tmdb.get(endpoint, { params: { language: "en-US" } });
    return res.data?.title || res.data?.name || null;
  } catch {
    return null;
  }
};

// Польська назва
export const getTitleInPolish = async (tmdbId, mediaType = "movie") => {
  try {
    const endpoint = mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
    const res = await tmdb.get(endpoint, { params: { language: "pl-PL" } });
    return res.data?.title || res.data?.name || null;
  } catch {
    return null;
  }
};

// Деталі серіалу
export const getTvDetails = async (tmdbId) => {
  const res = await tmdb.get(`/tv/${tmdbId}`, {
    params: {
      append_to_response: "credits,videos,images,reviews",
      include_image_language: "uk,en,null",
      include_video_language: "uk,en",
    },
  });
  return res.data;
};

// Відгуки
export const getReviews = async (tmdbId, mediaType = "movie") => {
  try {
    const endpoint = mediaType === "tv" ? `/tv/${tmdbId}/reviews` : `/movie/${tmdbId}/reviews`;
    const res = await tmdb.get(endpoint, { params: { page: 1, language: "en-US" } });
    return res.data?.results || [];
  } catch { return []; }
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

export const getPersonDetails = async (personId) => {
  const res = await tmdb.get(`/person/${personId}`, {
    params: { append_to_response: "combined_credits,images" },
  });
  return res.data;
};

export const getCollectionDetails = async (collectionId) => {
  const res = await tmdb.get(`/collection/${collectionId}`);
  return res.data;
};

const TMDB_GENRE_MAP = {
  28: "Бойовик", 12: "Пригоди", 16: "Анімація", 35: "Комедія", 80: "Кримінал",
  99: "Документальний", 18: "Драма", 10751: "Сімейний", 14: "Фентезі", 36: "Історичний",
  27: "Жахи", 10402: "Музика", 9648: "Детектив", 10749: "Мелодрама", 878: "Фантастика",
  10770: "ТВ-фільм", 53: "Трилер", 10752: "Воєнний", 37: "Вестерн",
  // TV-specific
  10759: "Екшн", 10762: "Дитячий", 10763: "Новини", 10764: "Реаліті", 10765: "Sci-Fi & Fantasy",
  10766: "Мильна опера", 10767: "Ток-шоу", 10768: "Воєнна & Політика", 10769: "Іноземний",
};

// Нормалізація TMDB item у формат FeaturedCard / MediaCard
export function normalizeTmdbItem(item) {
  const mediaType = item.media_type || "movie";
  const title = item.title || item.name || "";
  const originName = item.original_title || item.original_name || "";
  const releaseDate = (item.release_date || item.first_air_date || "").slice(0, 4);
  const rawGenres = item.genres || item.genre_ids || [];
  const genres = rawGenres
    .map((g) => typeof g === "string" ? g : typeof g === "object" ? g.name : TMDB_GENRE_MAP[g])
    .filter(Boolean)
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
    backdrop: tmdbBackdrop(item.backdrop_path, "w1280"),
    backdrop_url_original: tmdbBackdrop(item.backdrop_path, "w1280"),
    logo_url: null,
    trailer_tmdb: null, // заповнюється окремо через getVideos
    type: mediaType === "tv" ? "series" : "film",
    filmDecribe: releaseDate,
    _isTmdb: true,
  };
}
