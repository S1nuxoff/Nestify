import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getTrending,
  getPopularMovies,
  getPopularTv,
  getNowPlaying,
  getTopRated,
  getVideos,
  getMovieDetails,
  getTvDetails,
  normalizeTmdbItem,
  tmdbImg,
} from "../api/tmdb";
import { getWatchHistory } from "../api/v3";

import Featured from "../components/section/Featured";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ContentRowSwiper from "../components/section/ContentRowSwiper";
import MediaCard from "../components/ui/MediaCard";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";
import Alert from "../components/ui/Alert";

import "../styles/HomePage.css";

// Парсить movie_id: "tmdb_movie_123" або "tmdb_tv_123" → { mediaType, tmdbId }
function parseTmdbId(movie_id) {
  const match = String(movie_id || "").match(/^tmdb_(movie|tv)_(\d+)$/);
  if (match) return { mediaType: match[1], tmdbId: match[2] };
  return null;
}

// Збагачує history item TMDB даними
async function enrichHistoryItem(item) {
  const parsed = parseTmdbId(item.movie_id);
  if (!parsed) return null; // старий Rezka запис — пропускаємо

  try {
    const fetch = parsed.mediaType === "tv" ? getTvDetails : getMovieDetails;
    const details = await fetch(parsed.tmdbId);
    return {
      ...item,
      tmdbId: parsed.tmdbId,
      mediaType: parsed.mediaType,
      filmName: details.title || details.name,
      filmImage: tmdbImg(details.poster_path, "w342"),
      image: tmdbImg(details.poster_path, "w342"),
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

export default function HomePage() {
  const [showPlayerConnected, setShowPlayerConnected] = useState(false);
  const [featured, setFeatured] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [popularTv, setPopularTv] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [topMovies, setTopMovies] = useState([]);
  const [topTv, setTopTv] = useState([]);
  const [trendingTv, setTrendingTv] = useState([]);
  const [history, setHistory] = useState([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();
  const playerConnectionRef = useRef(nestifyPlayerClient.isConnected);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("current_user");
      setCurrentUser(raw ? JSON.parse(raw) : null);
    } catch {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [trending, pm, ptv, np, tm, ttv, trendTv] = await Promise.all([
          getTrending("week"),
          getPopularMovies(),
          getPopularTv(),
          getNowPlaying(),
          getTopRated("movie"),
          getTopRated("tv"),
          getTrending("week").then((r) => r.filter((i) => i.media_type === "tv")),
        ]);

        // Перші 8 для Featured — паралельно підтягуємо трейлери
        const featuredRaw = trending.slice(0, 8);
        const featuredNorm = featuredRaw.map(normalizeTmdbItem);

        // Підтягуємо трейлери паралельно
        const trailers = await Promise.all(
          featuredRaw.map((item) =>
            getVideos(item.id, item.media_type || "movie").catch(() => [])
          )
        );
        const featuredWithTrailers = featuredNorm.map((item, i) => ({
          ...item,
          trailer_tmdb: pickTrailerUrl(trailers[i] || []),
        }));

        setFeatured(featuredWithTrailers);

        setPopularMovies(pm.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" })));
        setPopularTv(ptv.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" })));
        setNowPlaying(np.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" })));
        setTopMovies(tm.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" })));
        setTopTv(ttv.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" })));
        setTrendingTv(trendTv.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" })));
      } catch (e) {
        console.error("TMDB load error:", e);
      } finally {
        setIsPageLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) {
      setIsHistoryLoading(false);
      return;
    }
    (async () => {
      try {
        const raw = await getWatchHistory(currentUser.id);
        // Збагачуємо паралельно
        const enriched = await Promise.all(raw.map(enrichHistoryItem));
        setHistory(enriched.filter(Boolean));
      } catch {
        setHistory([]);
      } finally {
        setIsHistoryLoading(false);
      }
    })();
  }, [currentUser?.id]);

  useEffect(() => {
    const handler = (isOnline) => {
      const was = playerConnectionRef.current;
      playerConnectionRef.current = isOnline;
      if (isOnline && !was) {
        setShowPlayerConnected(true);
        setTimeout(() => setShowPlayerConnected(false), 2500);
      }
    };
    nestifyPlayerClient.on("connected", handler);
    return () => nestifyPlayerClient.off("connected", handler);
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

  const continueWatching = Array.isArray(history)
    ? history.filter(
        (m) =>
          m.position_seconds > 30 &&
          m.duration > 0 &&
          m.position_seconds / m.duration < 0.95
      )
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

      {/* Великий Featured слайдер */}
      {featured.length > 0 && (
        <Featured onMovieSelect={handleMovieSelect} featured={featured} />
      )}

      <div className="container">
        <div className="home-page-content">
          {!isPageLoading && (
            <>
              {!isHistoryLoading && continueWatching.length > 0 && (
                <ContentRowSwiper
                  data={continueWatching}
                  title="Продовжити перегляд"
                  navigate_to="/history"
                  CardComponent={MediaCard}
                  cardProps={{ type: "continue", onMovieSelect: handleMovieSelect }}
                />
              )}

              <ContentRowSwiper
                data={nowPlaying}
                title="Зараз в кіно"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                rows={1}
              />

              <ContentRowSwiper
                data={popularMovies}
                title="Популярні фільми"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                rows={1}
              />

              <ContentRowSwiper
                data={popularTv}
                title="Популярні серіали"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                rows={1}
              />

              <ContentRowSwiper
                data={topMovies}
                title="Топ фільми всіх часів"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                rows={1}
              />

              <ContentRowSwiper
                data={trendingTv}
                title="Серіали в тренді за тиждень"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                rows={1}
              />

              <ContentRowSwiper
                data={topTv}
                title="Топ серіали всіх часів"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                rows={1}
              />
            </>
          )}

          {isPageLoading && (
            <div className="spinner-wrapper">
              <div className="spinner" />
            </div>
          )}

          <Footer />
        </div>
      </div>
    </>
  );
}
