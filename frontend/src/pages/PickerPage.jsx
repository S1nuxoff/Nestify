import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { X, Heart, Star, RefreshCw, ChevronLeft, Play, Rows3 } from "lucide-react";
import { getPickerMovies, getTrailer } from "../api/hdrezka";
import { toRezkaSlug } from "../core/rezkaLink";
import PickerSetup from "../components/ui/PickerSetup";
import "../styles/PickerPage.css";

function PickerCard({ movie, onSwipe, zIndex }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-12, 12]);
  const likeOpacity = useTransform(x, [30, 120], [0, 1]);
  const skipOpacity = useTransform(x, [-120, -30], [1, 0]);
  const bgX = useTransform(x, [-300, 300], ["52%", "48%"]);

  const handleDragEnd = (_, info) => {
    if (info.offset.x > 100) onSwipe("right");
    else if (info.offset.x < -100) onSwipe("left");
  };

  const backdrop = movie.backdrop || movie.image;

  return (
    <motion.div
      className="pc-card"
      style={{ x, rotate, zIndex }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileDrag={{ cursor: "grabbing" }}
    >
      {/* Backdrop */}
      <motion.div
        className="pc-backdrop"
        style={{ backgroundImage: `url(${backdrop})`, backgroundPositionX: bgX }}
      />
      <div className="pc-backdrop-dim" />

      {/* Poster + info */}
      <div className="pc-body">
        <img src={movie.poster || movie.image} alt={movie.title} className="pc-poster" draggable={false} />
        <div className="pc-info">
          <div className="pc-meta-row">
            {movie.year && <span className="pc-chip">{movie.year}</span>}
            {movie.type && <span className="pc-chip">{movie.type === "film" ? "Фільм" : movie.type === "series" ? "Серіал" : movie.type === "cartoon" ? "Мультфільм" : "Аніме"}</span>}
            {movie.rating && (
              <span className="pc-chip pc-chip--rating">
                <Star size={11} fill="currentColor" /> {movie.rating}
              </span>
            )}
          </div>
          <h2 className="pc-title">{movie.title}</h2>
          {movie.tmdb_title && movie.tmdb_title !== movie.title && (
            <p className="pc-origin">{movie.tmdb_title}</p>
          )}
          {(movie.short_desc?.trim() || movie.overview) && (
            <p className="pc-overview">{movie.short_desc?.trim() || movie.overview}</p>
          )}
        </div>
      </div>

      {/* Drag badges */}
      <motion.div className="pc-badge pc-badge--like" style={{ opacity: likeOpacity }}>
        <Heart size={18} fill="currentColor" /> Дивитись
      </motion.div>
      <motion.div className="pc-badge pc-badge--skip" style={{ opacity: skipOpacity }}>
        <X size={18} /> Далі
      </motion.div>
    </motion.div>
  );
}

function TrailerModal({ trailerKey, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="pc-trailer-overlay" onClick={onClose}>
      <div className="pc-trailer-frame" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Trailer"
        />
        <button className="pc-trailer-close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

export default function PickerPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("setup"); // "setup" | "picking"
  const [filters, setFilters] = useState({});
  const [movies, setMovies] = useState([]);
  const [index, setIndex] = useState(0);
  const [exitDir, setExitDir] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [trailerLoading, setTrailerLoading] = useState(false);

  const load = useCallback(async (activeFilters = {}) => {
    setLoading(true);
    try {
      const data = await getPickerMovies(50, activeFilters);
      setMovies(data);
      setIndex(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSetupStart = useCallback((selectedFilters) => {
    setFilters(selectedFilters);
    setPhase("picking");
    load(selectedFilters);
  }, [load]);

  // no auto-load on mount — wait for setup

  const swipe = useCallback((dir) => {
    setExitDir(dir);
    setTimeout(() => {
      setIndex((i) => i + 1);
      setExitDir(null);
    }, 380);
  }, []);

  const handleLike = useCallback(() => {
    const movie = movies[index];
    if (!movie) return;
    navigate(`/movie/${toRezkaSlug(movie.link)}`);
  }, [movies, index, navigate]);

  const handleSkip = useCallback(() => swipe("left"), [swipe]);

  const handleTrailer = useCallback(async () => {
    const movie = movies[index];
    if (!movie?.tmdb_id) return;
    setTrailerLoading(true);
    try {
      const data = await getTrailer(movie.tmdb_id, movie.tmdb_type || "movie");
      setTrailerKey(data.key);
    } catch {
      // no trailer available
    } finally {
      setTrailerLoading(false);
    }
  }, [movies, index]);

  useEffect(() => {
    const handler = (e) => {
      if (trailerKey) return; // modal is open, don't handle
      if (e.key === "ArrowRight") handleLike();
      if (e.key === "ArrowLeft") handleSkip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleLike, handleSkip, trailerKey]);

  const movie = movies[index];
  const next = movies[index + 1];
  const isEmpty = !loading && movies.length > 0 && index >= movies.length;

  if (phase === "setup") {
    return <PickerSetup onStart={handleSetupStart} />;
  }

  return (
    <div className="picker-page">
      {/* Minimal header */}
      <div className="pc-header">
        <button className="pc-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </button>
        <span className="pc-header-title">Що подивитись?</span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="pc-refresh-btn" onClick={() => navigate("/feed")} title="TikTok-режим">
            <Rows3 size={16} />
          </button>
          <button className="pc-refresh-btn" onClick={() => load(filters)} title="Оновити">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="pc-stage">
        {loading && (
          <div className="pc-loading">
            <div className="spinner" />
          </div>
        )}

        {isEmpty && (
          <div className="pc-empty">
            <p>Переглянув всі 👀</p>
            <button className="pc-action-refresh" onClick={load}>
              <RefreshCw size={16} /> Оновити
            </button>
          </div>
        )}

        {!loading && movie && (
          <>
            {/* Behind card */}
            {next && (
              <motion.div
                className="pc-card pc-card--behind"
                animate={{ scale: 0.94, y: 18 }}
                transition={{ duration: 0.3 }}
                style={{ zIndex: 1 }}
              >
                <div
                  className="pc-backdrop"
                  style={{ backgroundImage: `url(${next.backdrop || next.image})` }}
                />
                <div className="pc-backdrop-dim" />
                <div className="pc-body">
                  <img src={next.poster || next.image} alt="" className="pc-poster" draggable={false} />
                </div>
              </motion.div>
            )}

            {/* Active card */}
            <AnimatePresence>
              {exitDir ? (
                <motion.div
                  key={`exit-${index}`}
                  className="pc-card"
                  style={{ zIndex: 10 }}
                  initial={{ x: 0, rotate: 0, opacity: 1 }}
                  animate={{
                    x: exitDir === "right" ? 700 : -700,
                    rotate: exitDir === "right" ? 15 : -15,
                    opacity: 0,
                  }}
                  transition={{ duration: 0.38, ease: "easeIn" }}
                >
                  <div className="pc-backdrop" style={{ backgroundImage: `url(${movie.backdrop || movie.image})` }} />
                  <div className="pc-backdrop-dim" />
                  <div className="pc-body">
                    <img src={movie.poster || movie.image} alt="" className="pc-poster" draggable={false} />
                  </div>
                </motion.div>
              ) : (
                <PickerCard
                  key={`card-${index}`}
                  movie={movie}
                  zIndex={10}
                  onSwipe={(dir) => dir === "right" ? handleLike() : swipe(dir)}
                />
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Counter */}
      {!loading && movie && (
        <div className="pc-counter">{index + 1} / {movies.length}</div>
      )}

      {/* Actions */}
      {!loading && movie && (
        <div className="pc-actions">
          <button className="pc-btn pc-btn--skip" onClick={handleSkip} aria-label="Далі">
            <X size={26} />
          </button>
          {movie.tmdb_id && (
            <button
              className="pc-btn pc-btn--trailer"
              onClick={handleTrailer}
              disabled={trailerLoading}
              aria-label="Трейлер"
            >
              {trailerLoading
                ? <div className="pc-spinner" />
                : <Play size={20} fill="currentColor" />
              }
            </button>
          )}
          <button className="pc-btn pc-btn--like" onClick={handleLike} aria-label="Дивитись">
            <Heart size={26} fill="currentColor" />
          </button>
        </div>
      )}

      <div className="pc-hint">
        <span>← пропустити</span>
        <span>дивитись →</span>
      </div>

      {/* Trailer modal */}
      {trailerKey && (
        <TrailerModal trailerKey={trailerKey} onClose={() => setTrailerKey(null)} />
      )}
    </div>
  );
}
