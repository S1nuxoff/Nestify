import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getTrending,
  getMonthlyTrending,
  getPopularMovies,
  getPopularTv,
  getNowPlaying,
  getTopRated,
  getMovieDetails,
  getTvDetails,
  normalizeTmdbItem,
  pickTmdbLogo,
  tmdbImg,
  tmdbImgOriginal,
  discover,
  getOnTheAir,
  getRecommendations,
} from "../api/tmdb";
import { getWatchHistory } from "../api/v3";

import Featured from "../components/section/Featured";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ContentRow from "../components/section/ContentRow";
import MediaCard from "../components/ui/MediaCard";
import CategorySelector from "../components/ui/CategorySelector";
import BackdropCard from "../components/ui/BackdropCard";
import ContinueCard from "../components/ui/ContinueCard";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";
import Alert from "../components/ui/Alert";

import "../styles/HomePage.css";
import "../styles/ContinueCard.css";

const CATEGORIES = [
  { key: "all", label: "Все" },
  { key: "movies", label: "Фільми" },
  { key: "tv", label: "Серіали" },
  { key: "animation", label: "Анімація" },
];

function parseTmdbId(movie_id) {
  const match = String(movie_id || "").match(/^tmdb_(movie|tv)_(\d+)$/);
  if (match) return { mediaType: match[1], tmdbId: match[2] };
  return null;
}

async function enrichHistoryItem(item) {
  const parsed = parseTmdbId(item.movie_id);
  if (!parsed) return null;
  try {
    const fetchFn = parsed.mediaType === "tv" ? getTvDetails : getMovieDetails;
    const details = await fetchFn(parsed.tmdbId);
    return {
      ...item,
      tmdbId: parsed.tmdbId,
      mediaType: parsed.mediaType,
      filmName: details.title || details.name,
      filmImage: tmdbImg(details.poster_path, "w342"),
      image: tmdbImg(details.poster_path, "w342"),
      backdrop: tmdbImgOriginal(details.backdrop_path),
      release_date: (details.release_date || details.first_air_date || "").slice(0, 4),
      genre: (details.genres || []).map((g) => g.name).slice(0, 1),
      _isTmdb: true,
    };
  } catch {
    return null;
  }
}

function pickTrailerUrl(videos) {
  const order = ["Trailer", "Teaser", "Clip"];
  for (const type of order) {
    const v = videos.find((v) => v.site === "YouTube" && v.type === type);
    if (v) return `https://www.youtube.com/watch?v=${v.key}`;
  }
  return null;
}

async function buildFeatured(rawItems) {
  const featuredRaw = rawItems.slice(0, 8);
  const featuredNorm = featuredRaw.map(normalizeTmdbItem);
  const featuredDetails = await Promise.all(
    featuredRaw.map((item) => {
      const fetchDetails = (item.media_type || "movie") === "tv" ? getTvDetails : getMovieDetails;
      return fetchDetails(item.id).catch(() => null);
    })
  );
  return featuredNorm.map((item, i) => {
    const details = featuredDetails[i];

    // Clean backdrop without text (iso_639_1: null), best vote_average
    const cleanBackdrop = (details?.images?.backdrops || [])
      .filter((b) => b.iso_639_1 === null)
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))[0];

    const backdropUrl = cleanBackdrop
      ? tmdbImgOriginal(cleanBackdrop.file_path)
      : (tmdbImgOriginal(featuredRaw[i]?.backdrop_path) || item.backdrop);

    const cast = (details?.credits?.cast || []).slice(0, 4).map((a) => a.name);
    const director = (details?.credits?.crew || []).find((c) => c.job === "Director")?.name || null;

    return {
      ...item,
      backdrop: backdropUrl,
      backdrop_url_original: backdropUrl,
      trailer_tmdb: pickTrailerUrl(details?.videos?.results || []),
      logo_url: pickTmdbLogo(details?.images?.logos || []),
      country: details?.production_countries?.[0]?.iso_3166_1 || null,
      genres_list: (details?.genres || []).map((g) => g.name).slice(0, 2),
      cast,
      director,
      runtime: details?.runtime || null,
    };
  });
}

const norm = (items, type) => items.map((i) => normalizeTmdbItem({ ...i, media_type: type }));
const W = true; // wide = BackdropCard
const N = false; // narrow = MediaCard

// Module-level cache — survives component unmount/remount
const pageCache = {};

async function fetchCategoryData(category) {
  if (category === "all") {
    const [trending, trendingMonth, pm, ptv, np, tm, ttv, onAir] = await Promise.all([
      getTrending("week"),
      getMonthlyTrending("all"),
      getPopularMovies(),
      getPopularTv(),
      getNowPlaying(),
      getTopRated("movie"),
      getTopRated("tv"),
      getOnTheAir(),
    ]);
    const featured = await buildFeatured(trending);
    const topMix = [...tm.map((i) => ({ ...i, media_type: "movie" })), ...ttv.map((i) => ({ ...i, media_type: "tv" }))]
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 20).map(normalizeTmdbItem);
    return {
      featured,
      sections: [
        { title: "Тренд місяця", data: trendingMonth.map(normalizeTmdbItem), wide: W },
        { title: "Найкраще за весь час", data: topMix, wide: N },
        { title: "Зараз в кіно", data: norm(np, "movie"), wide: W },
        { title: "Популярні серіали", data: norm(ptv, "tv"), wide: N },
        { title: "Серіали в ефірі", data: norm(onAir, "tv"), wide: W },
        { title: "Популярні фільми", data: norm(pm, "movie"), wide: N },
      ],
    };
  }

  if (category === "movies") {
    const [trending, trendingMonth, np, pm, tm, upcoming] = await Promise.all([
      getTrending("week").then((r) => r.filter((i) => i.media_type === "movie")),
      getMonthlyTrending("movie"),
      getNowPlaying(),
      getPopularMovies(),
      getTopRated("movie"),
      discover("movie", { sort_by: "release_date.desc", "primary_release_date.gte": "2024-01-01" }).then((r) => r.results),
    ]);
    const featured = await buildFeatured(trending.length ? trending : pm.map((i) => ({ ...i, media_type: "movie" })));
    return {
      featured,
      sections: [
        { title: "Тренд місяця", data: norm(trendingMonth, "movie"), wide: W },
        { title: "Найкраще за весь час", data: norm(tm, "movie"), wide: N },
        { title: "Зараз в кіно", data: norm(np, "movie"), wide: W },
        { title: "Нові фільми", data: norm(upcoming, "movie"), wide: N },
      ],
    };
  }

  if (category === "tv") {
    const [trending, trendingMonth, ptv, ttv, onAir] = await Promise.all([
      getTrending("week").then((r) => r.filter((i) => i.media_type === "tv")),
      getMonthlyTrending("tv"),
      getPopularTv(),
      getTopRated("tv"),
      getOnTheAir(),
    ]);
    const featured = await buildFeatured(trending.length ? trending : ptv.map((i) => ({ ...i, media_type: "tv" })));
    return {
      featured,
      sections: [
        { title: "Тренд місяця", data: norm(trendingMonth, "tv"), wide: W },
        { title: "Найкраще за весь час", data: norm(ttv, "tv"), wide: N },
        { title: "Зараз в ефірі", data: norm(onAir, "tv"), wide: W },
        { title: "В тренді цього тижня", data: trending.map(normalizeTmdbItem), wide: N },
      ],
    };
  }

  if (category === "animation") {
    const date = new Date(); date.setDate(date.getDate() - 30);
    const since = date.toISOString().split("T")[0];
    const [animM, animTv, topAnim, topAnimTv, animMonthM] = await Promise.all([
      discover("movie", { with_genres: "16" }).then((r) => r.results),
      discover("tv", { with_genres: "16" }).then((r) => r.results),
      discover("movie", { with_genres: "16", sort_by: "vote_average.desc", "vote_count.gte": "300" }).then((r) => r.results),
      discover("tv", { with_genres: "16", sort_by: "vote_average.desc", "vote_count.gte": "300" }).then((r) => r.results),
      discover("movie", { with_genres: "16", sort_by: "popularity.desc", "primary_release_date.gte": since }).then((r) => r.results),
    ]);
    const allAnim = [...animM.map((i) => ({ ...i, media_type: "movie" })), ...animTv.map((i) => ({ ...i, media_type: "tv" }))];
    const featured = await buildFeatured(allAnim);
    return {
      featured,
      sections: [
        { title: "Тренд місяця", data: norm(animMonthM, "movie"), wide: W },
        { title: "Топ мультсеріали", data: norm(topAnimTv, "tv"), wide: N },
        { title: "Популярні мультсеріали", data: norm(animTv, "tv"), wide: W },
        { title: "Топ мультфільми", data: norm(topAnim, "movie"), wide: N },
      ],
    };
  }

  return { featured: [], sections: [] };
}

export default function HomePage() {
  const [showPlayerConnected, setShowPlayerConnected] = useState(false);
  const cached0 = pageCache["all"];
  const [featured, setFeatured] = useState(cached0?.featured || []);
  const [sections, setSections] = useState(cached0?.sections || []);
  const [isPageLoading, setIsPageLoading] = useState(!cached0);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [forYouRaw, setForYouRaw] = useState([]); // raw TMDB items, unfiltered
  const [currentUser, setCurrentUser] = useState(null);
  const [homeCategory, setHomeCategory] = useState("all");

  const navigate = useNavigate();


  useEffect(() => {
    try {
      const raw = localStorage.getItem("current_user");
      setCurrentUser(raw ? JSON.parse(raw) : null);
    } catch {
      setCurrentUser(null);
    }
  }, []);

  const loadCategory = useCallback(async (category) => {
    if (pageCache[category]) {
      const cached = pageCache[category];
      setFeatured(cached.featured);
      setSections(cached.sections);
      setIsPageLoading(false);
      return;
    }
    setIsCategoryLoading(true);
    try {
      const result = await fetchCategoryData(category);
      pageCache[category] = result;
      setFeatured(result.featured);
      setSections(result.sections);
    } catch (e) {
      console.error("Category load error:", e);
    } finally {
      setIsCategoryLoading(false);
      setIsPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pageCache["all"]) loadCategory("all");
  }, [loadCategory]);

  const handleCategoryChange = (cat) => {
    if (cat === homeCategory) return;
    setHomeCategory(cat);
    loadCategory(cat);
  };

  useEffect(() => {
    if (!currentUser?.id) { setIsHistoryLoading(false); return; }
    (async () => {
      try {
        const raw = await getWatchHistory(currentUser.id);
        const enriched = await Promise.all(raw.map(enrichHistoryItem));
        const filtered = enriched.filter(Boolean);
        setHistory(filtered);

        // Build "For You" recommendations from last 3 watched — store raw for category filtering
        const seeds = filtered.slice(0, 3);
        if (seeds.length > 0) {
          const watchedIds = new Set(filtered.map((m) => String(m.tmdbId)));
          const recArrays = await Promise.all(
            seeds.map((m) => getRecommendations(m.tmdbId, m.mediaType).catch(() => []))
          );
          const seen = new Set();
          const merged = [];
          for (const items of recArrays) {
            for (const item of items) {
              const key = String(item.id);
              if (!seen.has(key) && !watchedIds.has(key)) {
                seen.add(key);
                merged.push({ ...item, media_type: item.media_type || "movie" });
              }
            }
          }
          setForYouRaw(merged);
        }
      } catch {
        setHistory([]);
      } finally {
        setIsHistoryLoading(false);
      }
    })();
  }, [currentUser?.id]);

  useEffect(() => {
    const handler = () => {
      setShowPlayerConnected(true);
      setTimeout(() => setShowPlayerConnected(false), 2500);
    };
    nestifyPlayerClient.on("deviceOnline", handler);
    return () => nestifyPlayerClient.off("deviceOnline", handler);
  }, []);

  const handleMovieSelect = (movie) => {
    if (movie?.tmdbId && movie?.mediaType) {
      navigate(`/title/${movie.mediaType}/${movie.tmdbId}`);
      return;
    }
    if (movie?._isTmdb) {
      navigate(`/title/${movie.mediaType || "movie"}/${movie.tmdbId}`);
    }
  };

  const ANIMATION_GENRE_ID = 16;

  const forYou = useMemo(() => {
    if (!forYouRaw.length) return [];
    let filtered = forYouRaw;
    if (homeCategory === "movies") {
      filtered = forYouRaw.filter((i) => i.media_type === "movie" && !(i.genre_ids || []).includes(ANIMATION_GENRE_ID));
    } else if (homeCategory === "tv") {
      filtered = forYouRaw.filter((i) => i.media_type === "tv" && !(i.genre_ids || []).includes(ANIMATION_GENRE_ID));
    } else if (homeCategory === "animation") {
      filtered = forYouRaw.filter((i) => (i.genre_ids || []).includes(ANIMATION_GENRE_ID));
    }
    return filtered.slice(0, 20).map((i) => normalizeTmdbItem(i));
  }, [forYouRaw, homeCategory]);

  const continueWatching = Array.isArray(history)
    ? history.filter((m) => m.position_seconds > 30 && m.duration > 0 && m.position_seconds / m.duration < 0.95)
    : [];

  return (
    <>
      <Alert
        visible={showPlayerConnected}
        type="success"
        title="Nestify Player підключено"
        message="З'єднання з плеєром встановлено успішно!"
      />

      <div className="container">
        <Header currentUser={currentUser || {}} />
      </div>

      {featured.length > 0 && (
        <Featured onMovieSelect={handleMovieSelect} featured={featured} />
      )}

      <div className="container">
        <div className="home-page-content">

          {!isHistoryLoading && continueWatching.length > 0 && (
            <div className="continue-watching-row">
              <div className="cw-header">
                <h2 className="cw-title">Продовжити перегляд</h2>
              </div>
              <div className="cw-scroll">
                {continueWatching.map((movie, i) => (
                  <ContinueCard
                    key={movie.id || movie.movie_id || i}
                    movie={movie}
                    onMovieSelect={handleMovieSelect}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Category selector */}
          <CategorySelector
            categories={CATEGORIES}
            active={homeCategory}
            onChange={handleCategoryChange}
          />

          {/* For You — filtered by active category */}
          {!isHistoryLoading && forYou.length > 0 && (
            <ContentRow
              title="Рекомендовано для тебе"
              data={forYou}
              CardComponent={MediaCard}
              cardProps={{ onMovieSelect: handleMovieSelect }}
            />
          )}

          {(isPageLoading || isCategoryLoading) && (
            <div className="spinner-wrapper">
              <div className="spinner" />
            </div>
          )}

          {!isPageLoading && !isCategoryLoading && sections.map((s) => (
            <ContentRow
              key={s.title}
              data={s.data}
              title={s.title}
              CardComponent={s.wide ? BackdropCard : MediaCard}
              cardProps={{ onMovieSelect: handleMovieSelect }}
              autoWidth={s.wide}
            />
          ))}

          <Footer />
        </div>
      </div>
    </>
  );
}
