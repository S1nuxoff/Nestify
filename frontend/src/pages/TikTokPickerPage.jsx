import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import { Heart, Volume2, VolumeX, ChevronLeft, RefreshCw, LayoutGrid, Star } from "lucide-react";
import { getPickerMovies, getTrailer, getCategories } from "../api/hdrezka";
import { toRezkaSlug } from "../core/rezkaLink";
import PickerSetup from "../components/ui/PickerSetup";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../styles/TikTokPicker.css";

const PRELOAD_AHEAD  = 2; // fetch trailers N slides ahead
const MORE_THRESHOLD = 4; // load more when this many slides from end

/* ── Single slide ──────────────────────────────────────────── */
function TikTokSlide({ movie, trailerKey, isActive, muted, onWatch, isFirst }) {
  const backdrop = movie.backdrop || movie.poster || movie.image;
  const desc = movie.short_desc?.trim() || movie.overview;
  const typeLabel =
    movie.type === "film"    ? "Фільм"
    : movie.type === "series"  ? "Серіал"
    : movie.type === "cartoon" ? "Мультфільм"
    : movie.type === "anime"   ? "Аніме"
    : null;

  const iframeRef   = useRef(null);
  const timerRef    = useRef(null);
  const [speeding, setSpeeding] = useState(false);
  const [paused,   setPaused]   = useState(false);

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
    sendCmd(muted ? "mute" : "unMute");
    sendCmd(paused ? "pauseVideo" : "playVideo");
  }, [isActive, muted, paused, sendCmd, trailerKey]);

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
      // short tap — toggle pause
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setPaused((p) => { sendCmd(p ? "playVideo" : "pauseVideo"); return !p; });
    } else if (speeding) {
      // long press released — restore speed
      setSpeeding(false);
      setRate(1);
    }
  };

  // reset if slide goes inactive
  useEffect(() => {
    if (!isActive) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setSpeeding(false);
      setPaused(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !trailerKey) return undefined;

    const retryTimers = [150, 500, 1200].map((delay) =>
      setTimeout(syncPlayback, delay)
    );

    return () => retryTimers.forEach(clearTimeout);
  }, [isActive, trailerKey, muted, paused, syncPlayback]);

  // cleanup on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div
      className="tt-slide"
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
      onPointerCancel={onPressEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isActive && trailerKey ? (
        <iframe
          ref={iframeRef}
          key={`${trailerKey}-${muted}`}
          className="tt-video"
          src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${trailerKey}&controls=0&rel=0&playsinline=1&modestbranding=1&enablejsapi=1`}
          onLoad={syncPlayback}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={movie.title}
        />
      ) : (
        <div className="tt-backdrop" style={{ backgroundImage: `url(${backdrop})` }} />
      )}
      <div className="tt-gradient" />

      {speeding && <div className="tt-speed-badge">2×</div>}
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
        <button className="tt-btn tt-btn--watch" onClick={onWatch}>
          <Heart size={28} fill="currentColor" />
          <span>Дивитись</span>
        </button>
      </div>

      {isFirst && (
        <div className="tt-scroll-hint">
          <div className="tt-scroll-hint__arrow" />
          <span>гортай</span>
        </div>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function TikTokPickerPage() {
  const navigate   = useNavigate();
  const isDesktop  = useMediaQuery({ query: "(min-width: 600px)" });

  const [phase, setPhase]         = useState("setup");
  const [filters, setFilters]     = useState({});
  const [movies, setMovies]       = useState([]);
  const [trailers, setTrailers]   = useState({}); // { [link]: string | null }
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [muted, setMuted]         = useState(true);

  const [categories, setCategories] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("current_user");
      setCurrentUser(raw ? JSON.parse(raw) : null);
    } catch { setCurrentUser(null); }
    getCategories().then((r) => setCategories(r?.categories || [])).catch(() => {});
  }, []);

  const containerRef   = useRef(null);
  const slideRefs      = useRef([]);
  const fetchedRef     = useRef(new Set()); // links already fetched/fetching
  const seenLinksRef   = useRef(new Set()); // dedup across batches
  const loadingMoreRef = useRef(false);     // stable flag (avoids stale closure)
  const filtersRef     = useRef({});        // stable ref to current filters

  // ── Fetch one trailer (idempotent, no state deps) ──────────
  const fetchTrailerFor = useCallback((movie) => {
    if (!movie?.tmdb_id) return;
    const link = movie.link;
    if (fetchedRef.current.has(link)) return;
    fetchedRef.current.add(link);

    getTrailer(movie.tmdb_id, movie.tmdb_type || "movie")
      .then((d) => setTrailers((prev) => ({ ...prev, [link]: d.key })))
      .catch(()  => setTrailers((prev) => ({ ...prev, [link]: null })));
  }, []); // stable — no deps

  // ── Load more (appends to list) ────────────────────────────
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

  // ── Initial load ───────────────────────────────────────────
  const load = useCallback(async (activeFilters = {}) => {
    filtersRef.current = activeFilters;
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
    setFilters(selectedFilters);
    setPhase("running");
    load(selectedFilters);
  }, [load]);

  // ── Auto-skip slide when its trailer is not found ──────────
  const currentTrailerStatus = movies[activeIndex]
    ? trailers[movies[activeIndex].link]
    : undefined;

  useEffect(() => {
    if (currentTrailerStatus !== null) return; // undefined = still loading, string = has key
    const nextEl = slideRefs.current[activeIndex + 1];
    if (nextEl) nextEl.scrollIntoView({ behavior: "instant" });
  }, [currentTrailerStatus, activeIndex]);

  // ── React to active slide change ───────────────────────────
  useEffect(() => {
    if (!movies.length) return;

    // Pre-fetch trailers for current + next PRELOAD_AHEAD slides
    const from = Math.max(0, activeIndex - 1);
    const to   = Math.min(movies.length - 1, activeIndex + PRELOAD_AHEAD);
    for (let i = from; i <= to; i++) fetchTrailerFor(movies[i]);

    // Infinite load: trigger when near end
    if (activeIndex >= movies.length - MORE_THRESHOLD) loadMore();
  }, [activeIndex, movies, fetchTrailerFor, loadMore]);

  // ── IntersectionObserver ───────────────────────────────────
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
    if (!loading && containerRef.current)
      containerRef.current.scrollTo({ top: 0, behavior: "instant" });
  }, [loading]);

  const handleWatch = useCallback(
    (movie) => navigate(`/movie/${toRezkaSlug(movie.link)}`),
    [navigate]
  );

  if (phase === "setup") return <PickerSetup onStart={handleSetupStart} />;

  const card = (
    <div className="tt-page">
      <div className="tt-header">
        <button className="tt-header-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </button>
        <span className="tt-header-title">Підбір</span>
        <div className="tt-header-right">
          <button className="tt-header-btn" onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button className="tt-header-btn" onClick={() => navigate("/pick")}>
            <LayoutGrid size={18} />
          </button>
          <button className="tt-header-btn" onClick={() => load(filters)}>
            <RefreshCw size={16} />
          </button>
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
                  onWatch={() => handleWatch(movie)}
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
