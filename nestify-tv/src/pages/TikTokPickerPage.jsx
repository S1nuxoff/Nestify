import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import { Heart, Play, Volume2, VolumeX, ChevronLeft, RefreshCw, LayoutGrid, Star } from "lucide-react";
import { getMovie, getPickerMovies, getTrailer, getCategories } from "../api/hdrezka";
import { addLikedMovie, getLikedMovies, removeLikedMovie } from "../api/user";
import config from "../core/config";
import { loadSavedPickerFilters, savePickerFilters } from "../core/pickerFilters";
import { fromRezkaSlug, toRezkaSlug } from "../core/rezkaLink";
import PickerSetupPanel from "../components/ui/PickerSetupPanel";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../styles/TikTokPicker.css";

const PRELOAD_AHEAD  = 2; // fetch trailers N slides ahead
const MORE_THRESHOLD = 4; // load more when this many slides from end

function extractYouTubeKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^[A-Za-z0-9_-]{6,}$/.test(raw)) return raw;

  const embedMatch = raw.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i);
  if (embedMatch?.[1]) return embedMatch[1];

  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace(/^\/+/, "") || null;
    }

    const videoId = url.searchParams.get("v");
    if (videoId) return videoId;
  } catch {
    return null;
  }

  return null;
}

/* â”€â”€ Single slide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function TikTokSlide({
  movie,
  trailerKey,
  isActive,
  muted,
  onToggleMuted,
  onOpenPicker,
  onWatch,
  isLiked,
  onToggleLike,
  likePending,
  isFirst,
}) {
  const desc = movie.short_desc?.trim() || movie.overview;
  const typeLabel =
    movie.type === "film"    ? "Фільм"
    : movie.type === "series"  ? "Серіал"
    : movie.type === "cartoon" ? "Мультфільм"
    : movie.type === "anime"   ? "Аніме"
    : null;

  const iframeRef   = useRef(null);
  const timerRef    = useRef(null);
  const syncTimersRef = useRef([]);
  const revealTimerRef = useRef(null);
  const [speeding, setSpeeding] = useState(false);
  const [paused,   setPaused]   = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);

  const clearSyncTimers = useCallback(() => {
    syncTimersRef.current.forEach(clearTimeout);
    syncTimersRef.current = [];
  }, []);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const sendCmd = useCallback((func) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "https://www.youtube.com"
    );
  }, []);

  const setRate = useCallback((rate) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "setPlaybackRate", args: [rate] }),
      "https://www.youtube.com"
    );
  }, []);

  const syncPlayback = useCallback(() => {
    if (!isActive || !trailerKey) return;
    clearSyncTimers();

    if (paused) {
      sendCmd("pauseVideo");
      return;
    }

    // Mobile browsers block autoplay with sound, so always start muted first.
    sendCmd("mute");
    sendCmd("playVideo");

    const followUpCommands = muted
      ? [{ delay: 160, func: "mute" }]
      : [
          { delay: 180, func: "unMute" },
          { delay: 650, func: "unMute" },
        ];

    syncTimersRef.current = followUpCommands.map(({ delay, func }) =>
      setTimeout(() => sendCmd(func), delay)
    );
  }, [clearSyncTimers, isActive, muted, paused, sendCmd, trailerKey]);

  const revealVideo = useCallback(() => {
    clearRevealTimer();
    revealTimerRef.current = setTimeout(() => {
      setVideoVisible(true);
      revealTimerRef.current = null;
    }, 900);
  }, [clearRevealTimer]);

  const handleIframeLoad = useCallback(() => {
    syncPlayback();
    revealVideo();
  }, [revealVideo, syncPlayback]);

  const onPressStart = (e) => {
    if (e.target.closest("button")) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null; // mark fired
      setSpeeding(true);
      setRate(2);
    }, 200);
  };

  const onPressEnd = () => {
    if (timerRef.current !== null) {
      // short tap â€” toggle pause
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setPaused((p) => { sendCmd(p ? "playVideo" : "pauseVideo"); return !p; });
    } else if (speeding) {
      // long press released â€” restore speed
      setSpeeding(false);
      setRate(1);
    }
  };

  // reset if slide goes inactive
  useEffect(() => {
    if (!isActive) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      clearSyncTimers();
      clearRevealTimer();
      setSpeeding(false);
      setPaused(false);
      setVideoVisible(false);
    }
  }, [clearRevealTimer, clearSyncTimers, isActive]);

  useEffect(() => {
    setVideoVisible(false);
    clearRevealTimer();
  }, [clearRevealTimer, trailerKey]);

  useEffect(() => {
    if (!isActive || !trailerKey) return undefined;

    const retryTimers = [150, 500, 1200].map((delay) =>
      setTimeout(syncPlayback, delay)
    );

    return () => retryTimers.forEach(clearTimeout);
  }, [isActive, trailerKey, muted, paused, syncPlayback]);

  // cleanup on unmount
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    clearSyncTimers();
    clearRevealTimer();
  }, [clearRevealTimer, clearSyncTimers]);

  return (
    <div
      className="tt-slide"
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
      onPointerCancel={onPressEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="tt-backdrop" />

      {isActive && trailerKey && (
        <>
          <iframe
            ref={iframeRef}
            key={trailerKey}
            className={`tt-video${videoVisible ? " tt-video--visible" : ""}`}
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&loop=1&playlist=${trailerKey}&controls=0&fs=0&disablekb=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0&enablejsapi=1`}
            onLoad={handleIframeLoad}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            title={movie.title}
          />

          {!videoVisible && (
            <div className="tt-video-loader" aria-hidden="true">
              <div className="spinner" />
            </div>
          )}
        </>
      )}
      <div className="tt-gradient" />

      {speeding && <div className="tt-speed-badge">2Ă—</div>}
      {paused && trailerKey && <div className="tt-pause-overlay"><div className="tt-pause-icon" /></div>}

      <div className="tt-info">
        <div className="tt-chips">
          {movie.year && <span className="tt-chip">{movie.year}</span>}
          {typeLabel && <span className="tt-chip">{typeLabel}</span>}
          {movie.rating && (
            <span className="tt-chip tt-chip--rating">
              <Star size={11} fill="currentColor" /> {movie.rating}
            </span>
          )}
        </div>
        <h2 className="tt-title">{movie.title}</h2>
        {movie.tmdb_title && movie.tmdb_title !== movie.title && (
          <p className="tt-origin">{movie.tmdb_title}</p>
        )}
        {desc && <p className="tt-desc">{desc}</p>}
      </div>

      <div className="tt-actions">
        <button
          className={`tt-btn tt-btn--like${isLiked ? " is-active" : ""}`}
          onClick={onToggleLike}
          disabled={likePending}
        >
          <Heart size={28} fill={isLiked ? "currentColor" : "none"} />
        </button>
        <button className="tt-btn" onClick={onToggleMuted}>
          {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </button>
        <button className="tt-btn tt-btn--watch" onClick={onWatch}>
          <Play size={28} fill="currentColor" />
           <span>Відкрити</span>
        </button>
        <button className="tt-btn" onClick={onOpenPicker}>
          <LayoutGrid size={24} />
        </button>
      </div>

      {isFirst && (
        <div className="tt-scroll-hint">
          <div className="tt-scroll-hint__arrow" />
          <span>Гортай</span>
        </div>
      )}
    </div>
  );
}

/* â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function TikTokPickerPage() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const isDesktop  = useMediaQuery({ query: "(min-width: 600px)" });
  const savedPickerFiltersRef = useRef(undefined);

  const likedFeedState =
    location.state?.source === "liked" && Array.isArray(location.state?.movies)
      ? location.state
      : null;
  if (savedPickerFiltersRef.current === undefined && !likedFeedState) {
    savedPickerFiltersRef.current = loadSavedPickerFilters();
  }
  const initialSavedFilters = likedFeedState ? null : (savedPickerFiltersRef.current ?? null);
  const hasInitialSavedFilters = !likedFeedState && initialSavedFilters !== null;
  const initialLikedMovies = likedFeedState?.movies ?? [];
  const initialLikedIndex = likedFeedState?.startLink
    ? Math.max(
        0,
        initialLikedMovies.findIndex(
          (movie) => toRezkaSlug(movie.link) === toRezkaSlug(likedFeedState.startLink)
        )
      )
    : 0;
  const likedFeedToken = likedFeedState
    ? `${toRezkaSlug(likedFeedState.startLink || "")}:${initialLikedMovies
        .map((movie) => movie.link)
        .join("|")}`
    : null;

  const [phase, setPhase]         = useState(likedFeedState || hasInitialSavedFilters ? "running" : "setup");
  const [filters, setFilters]     = useState(initialSavedFilters || {});
  const [movies, setMovies]       = useState(initialLikedMovies);
  const [trailers, setTrailers]   = useState({}); // { [link]: string | null }
  const [activeIndex, setActiveIndex] = useState(initialLikedIndex);
  const [loading, setLoading]     = useState(!likedFeedState && hasInitialSavedFilters);
  const [loadingMore, setLoadingMore] = useState(false);
  const [muted, setMuted]         = useState(false);
  const [likedLinks, setLikedLinks] = useState(() => new Set());
  const [likePendingLink, setLikePendingLink] = useState(null);
  const [feedSource, setFeedSource] = useState(likedFeedState ? "liked" : "picker");

  const [categories, setCategories] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("current_user");
      setCurrentUser(raw ? JSON.parse(raw) : null);
    } catch { setCurrentUser(null); }
    getCategories().then((r) => setCategories(r?.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser?.id) {
      setLikedLinks(new Set());
      return;
    }

    let cancelled = false;

    getLikedMovies(currentUser.id)
      .then((items) => {
        if (cancelled) return;
        setLikedLinks(
          new Set((items || []).map((item) => toRezkaSlug(item.link)).filter(Boolean))
        );
      })
      .catch((e) => {
        if (!cancelled) console.error("getLikedMovies error:", e);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const containerRef   = useRef(null);
  const slideRefs      = useRef([]);
  const fetchedRef     = useRef(new Set()); // links already fetched/fetching
  const seenLinksRef   = useRef(new Set()); // dedup across batches
  const loadingMoreRef = useRef(false);     // stable flag (avoids stale closure)
  const filtersRef     = useRef({});        // stable ref to current filters
  const initialScrollDoneRef = useRef(false);
  const appliedLikedFeedTokenRef = useRef(likedFeedToken);
  const autoLoadFiltersRef = useRef(hasInitialSavedFilters);

  const hydrateMovieForTrailer = useCallback(async (movie) => {
    if (!movie?.link || movie?.tmdb_id) return movie;

    try {
      const details = await getMovie(movie.link, currentUser?.id);
      const hydratedMovie = {
        ...movie,
        tmdb_id: details?.tmdb?.id ? String(details.tmdb.id) : movie.tmdb_id,
        tmdb_type: details?.tmdb?.type || movie.tmdb_type || null,
        tmdb_title:
          details?.tmdb?.title ||
          details?.tmdb?.original_title ||
          movie.tmdb_title ||
          null,
        overview: details?.tmdb?.overview || movie.overview || details?.description || null,
        short_desc: movie.short_desc || details?.description || null,
        backdrop: movie.backdrop || details?.backdrop || details?.backdrop_url_original || null,
        poster: movie.poster || details?.poster_tmdb || details?.image || null,
        image: movie.image || details?.image || details?.poster_tmdb || null,
        trailer_tmdb:
          movie.trailer_tmdb ||
          details?.trailer_tmdb ||
          details?.tmdb?.trailer_youtube ||
          null,
        rating: movie.rating || details?.rate || null,
        year:
          movie.year ||
          (details?.release_date
            ? Number(String(details.release_date).split(",")[0]) || null
            : null),
      };

      setMovies((prev) =>
        prev.map((item) =>
          item.link === movie.link ? { ...item, ...hydratedMovie } : item
        )
      );

      return hydratedMovie;
    } catch (e) {
      console.error("hydrateMovieForTrailer error:", e);
      return movie;
    }
  }, [currentUser?.id]);

  // â”€â”€ Fetch one trailer (idempotent, no state deps) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchTrailerFor = useCallback(async (movie) => {
    const link = movie?.link;
    if (!link) return;
    if (fetchedRef.current.has(link)) return;
    fetchedRef.current.add(link);

    const hydratedMovie = await hydrateMovieForTrailer(movie);
    const directTrailerKey = extractYouTubeKey(
      hydratedMovie?.trailer_tmdb || hydratedMovie?.trailer
    );
    if (directTrailerKey) {
      setTrailers((prev) => ({ ...prev, [link]: directTrailerKey }));
      return;
    }

    if (!hydratedMovie?.tmdb_id) return;

    getTrailer(hydratedMovie.tmdb_id, hydratedMovie.tmdb_type || "movie")
      .then((d) => {
        if (!d?.key) throw new Error("Trailer not found");
        setTrailers((prev) => ({ ...prev, [link]: d.key }));
      })
      .catch(() => {
        setTrailers((prev) => ({ ...prev, [link]: null }));
        setMovies((prev) => prev.filter((item) => item.link !== link));
      });
  }, [hydrateMovieForTrailer]);

  // â”€â”€ Load more (appends to list) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const data  = await getPickerMovies(15, filtersRef.current);
      const fresh = data.filter((m) => !seenLinksRef.current.has(m.link));
      fresh.forEach((m) => seenLinksRef.current.add(m.link));
      if (fresh.length) setMovies((prev) => [...prev, ...fresh]);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []); // stable

  // â”€â”€ Initial load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const load = useCallback(async (activeFilters = {}) => {
    filtersRef.current = activeFilters;
    setFeedSource("picker");
    setLoading(true);
    setMovies([]);
    setTrailers({});
    setActiveIndex(0);
    seenLinksRef.current   = new Set();
    fetchedRef.current     = new Set();
    loadingMoreRef.current = false;
    try {
      const data = await getPickerMovies(20, activeFilters);
      data.forEach((m) => seenLinksRef.current.add(m.link));
      setMovies(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSetupStart = useCallback((selectedFilters) => {
    const nextFilters = savePickerFilters(selectedFilters);
    setFilters(nextFilters);
    setFeedSource("picker");
    setPhase("running");
    load(nextFilters);
  }, [load]);

  useEffect(() => {
    if (!autoLoadFiltersRef.current || likedFeedState) return;
    autoLoadFiltersRef.current = false;
    load(initialSavedFilters || {});
  }, [initialSavedFilters, likedFeedState, load]);

  // â”€â”€ Auto-skip slide when its trailer is not found â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!movies.length) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((prev) => Math.min(prev, movies.length - 1));
  }, [movies.length]);

  // â”€â”€ React to active slide change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!movies.length) return;

    // Pre-fetch trailers for current + next PRELOAD_AHEAD slides
    const from = Math.max(0, activeIndex - 1);
    const to   = Math.min(movies.length - 1, activeIndex + PRELOAD_AHEAD);
    for (let i = from; i <= to; i++) fetchTrailerFor(movies[i]);

    // Infinite load: trigger when near end
    if (feedSource === "picker" && activeIndex >= movies.length - MORE_THRESHOLD) loadMore();
  }, [activeIndex, movies, fetchTrailerFor, loadMore, feedSource]);

  // â”€â”€ IntersectionObserver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !movies.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6)
            setActiveIndex(Number(entry.target.dataset.index));
        });
      },
      { root: container, threshold: 0.6 }
    );

    slideRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [movies]);

  // Scroll to top on fresh load
  useEffect(() => {
    if (feedSource === "picker" && !loading && containerRef.current)
      containerRef.current.scrollTo({ top: 0, behavior: "instant" });
  }, [loading, feedSource]);

  useEffect(() => {
    if (!likedFeedState) return;
    if (appliedLikedFeedTokenRef.current === likedFeedToken) return;

    setFeedSource("liked");
    setPhase("running");
    setMovies(likedFeedState.movies || []);
    setTrailers({});
    setActiveIndex(initialLikedIndex);
    seenLinksRef.current = new Set((likedFeedState.movies || []).map((movie) => movie.link));
    fetchedRef.current = new Set();
    loadingMoreRef.current = false;
    initialScrollDoneRef.current = false;
    appliedLikedFeedTokenRef.current = likedFeedToken;
  }, [likedFeedState, likedFeedToken, initialLikedIndex]);

  useEffect(() => {
    if (feedSource !== "liked" || initialScrollDoneRef.current) return;
    const target = slideRefs.current[activeIndex];
    if (!target) return;

    target.scrollIntoView({ behavior: "instant", block: "start" });
    initialScrollDoneRef.current = true;
  }, [activeIndex, feedSource, movies]);

  const handleWatch = useCallback(
    (movie) => navigate(`/movie/${toRezkaSlug(movie.link)}`),
    [navigate]
  );

  const handleToggleLike = useCallback(async (movie) => {
    if (!currentUser?.id || !movie?.link || likePendingLink === movie.link) return;

    const movieSlug = toRezkaSlug(movie.link);
    const canonicalLink = fromRezkaSlug(movieSlug, config.rezka_base_url);
    const alreadyLiked = likedLinks.has(movieSlug);
    const nextLiked = !alreadyLiked;
    setLikePendingLink(movie.link);
    setLikedLinks((prev) => {
      const next = new Set(prev);
      if (nextLiked) next.add(movieSlug);
      else next.delete(movieSlug);
      return next;
    });

    try {
      if (nextLiked) {
        await addLikedMovie({
          user_id: currentUser.id,
          movie_id: movie.id || movie.tmdb_id || null,
          tmdb_id: movie.tmdb_id ? String(movie.tmdb_id) : null,
          tmdb_type: movie.tmdb_type || null,
          link: canonicalLink,
          title: movie.title,
          origin_name: movie.tmdb_title || null,
          tmdb_title: movie.tmdb_title || null,
          image: movie.poster || movie.image || movie.backdrop || null,
          poster: movie.poster || movie.image || null,
          backdrop: movie.backdrop || null,
          description: movie.short_desc || movie.overview || null,
          overview: movie.overview || null,
          short_desc: movie.short_desc || null,
          release_date: movie.release_date || String(movie.year || ""),
          action: movie.action || null,
          type: movie.type || null,
          year: movie.year || null,
          rating: movie.rating ? String(movie.rating) : null,
        });
      } else {
        await removeLikedMovie({ user_id: currentUser.id, link: canonicalLink });
      }
    } catch (e) {
      setLikedLinks((prev) => {
        const next = new Set(prev);
        if (nextLiked) next.delete(movieSlug);
        else next.add(movieSlug);
        return next;
      });
      console.error("handleToggleLike error:", e);
    } finally {
      setLikePendingLink((prev) => (prev === movie.link ? null : prev));
    }
  }, [currentUser?.id, likePendingLink, likedLinks]);

  if (phase === "setup") {
    return (
      <PickerSetupPanel
        onStart={handleSetupStart}
        initialFilters={filters}
        onClose={movies.length ? () => setPhase("running") : null}
        onBack={() => navigate(-1)}
      />
    );
  }

  const card = (
    <div className="tt-page">
      <div className="tt-header">
        <button className="tt-header-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </button>
        <span className="tt-header-title">Підбір</span>
        <div className="tt-header-right">
          <button className="tt-header-btn" onClick={() => navigate("/liked")}>
            <Heart size={18} />
          </button>
          {feedSource === "picker" && (
            <button className="tt-header-btn" onClick={() => setPhase("setup")}>
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="tt-loading">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="tt-container" ref={containerRef}>
            {movies.map((movie, i) => (
              <div
                key={movie.link || i}
                ref={(el) => (slideRefs.current[i] = el)}
                data-index={i}
                className="tt-slide-wrapper"
              >
                <TikTokSlide
                  movie={movie}
                  trailerKey={trailers[movie.link] ?? null}
                  isActive={i === activeIndex}
                  muted={muted}
                  onToggleMuted={() => setMuted((m) => !m)}
                  onOpenPicker={() => navigate(feedSource === "liked" ? "/liked" : "/pick")}
                  onWatch={() => handleWatch(movie)}
                  isLiked={likedLinks.has(toRezkaSlug(movie.link))}
                  onToggleLike={() => handleToggleLike(movie)}
                  likePending={likePendingLink === movie.link}
                  isFirst={i === 0}
                />
              </div>
            ))}

            {loadingMore && (
              <div className="tt-slide-wrapper tt-loading-more-slide">
                <div className="tt-loading-more">
                  <div className="spinner" />
                </div>
              </div>
            )}
          </div>

          <div className="tt-counter">{activeIndex + 1} / {movies.length}</div>
        </>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <div className="tt-desktop-wrap">
        <div className="tt-dh"><Header categories={categories} currentUser={currentUser} /></div>
        <div className="tt-card-area">{card}</div>
        <div className="tt-df"><Footer /></div>
      </div>
    );
  }

  return card;
}

