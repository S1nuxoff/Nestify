// src/components/ui/FeaturedCard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

import "../../styles/FeaturedHeroCard.css";

function extractYouTubeKey(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function postToIframe(iframeEl, func, args = "") {
  if (!iframeEl) return;
  iframeEl.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args }),
    "*"
  );
}

export default function FeaturedCard({
  onMovieSelect,
  movie,
  isActive,
  resetTrigger,
}) {
  const [posterVisible] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  const wrapperRef = useRef(null);
  const iframeRef = useRef(null);
  const timerRef = useRef(null);

  const isDesktop = typeof window !== "undefined" && window.innerWidth > 900;
  const trailerKey = extractYouTubeKey(movie?.trailer_tmdb);

  // Intersection observer
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Trailer timer — starts when card is active & visible on desktop
  useEffect(() => {
    setShowTrailer(false);
    setPaused(false);
    setMuted(true);
    clearTimeout(timerRef.current);

    if (!isDesktop || !trailerKey || !isActive || !isVisible) return;

    timerRef.current = setTimeout(() => {
      setShowTrailer(true);
    }, 5000);

    return () => clearTimeout(timerRef.current);
  }, [isActive, isVisible, trailerKey, resetTrigger]);

  const handlePause = (e) => {
    e.stopPropagation();
    if (paused) {
      postToIframe(iframeRef.current, "playVideo");
      setPaused(false);
    } else {
      postToIframe(iframeRef.current, "pauseVideo");
      setPaused(true);
    }
  };

  const handleMute = (e) => {
    e.stopPropagation();
    if (muted) {
      postToIframe(iframeRef.current, "unMute");
      setMuted(false);
    } else {
      postToIframe(iframeRef.current, "mute");
      setMuted(true);
    }
  };

  const computed = useMemo(() => {
    const year = movie?.release_date ? String(movie.release_date).split(",")[0] : "";
    const ratingValue = Number(movie?.rate || 0);
    const runtime = movie?.runtime;
    const runtimeStr = runtime ? `${Math.floor(runtime / 60)}г ${runtime % 60}хв` : null;
    return { year, ratingValue, runtimeStr };
  }, [movie]);

  if (!movie) return null;

  const bgImage = movie?.backdrop || movie?.poster_tmdb || movie?.image;
  const posterImage = movie?.backdrop || movie?.image || bgImage;

  const genreItems = [
    ...(movie?.genres_list || []),
    ...(movie?.genre || []),
  ].filter(Boolean).slice(0, 3);

  const metaItems = [
    computed.year,
    computed.runtimeStr,
    computed.ratingValue > 0 ? computed.ratingValue.toFixed(1) : null,
    movie?.age,
  ].filter(Boolean);

  const trailerSrc = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1`
    : null;

  return (
    <section
      ref={wrapperRef}
      className={`fh-hero ${isActive ? "is-active" : ""}`}
      onClick={() => onMovieSelect?.(movie)}
      style={{ cursor: "pointer" }}
    >
      <div className="fh-media">
        <div className="fh-media__bg" style={{ backgroundImage: `url(${bgImage})` }} />
        <div className="fh-poster-wrap">
          <img
            className="fh-poster"
            src={posterImage}
            alt=""
            style={{
              opacity: showTrailer ? 0 : (posterVisible ? 0.92 : 0),
              transition: "opacity 1s ease-in-out",
              zIndex: 2,
            }}
          />
        </div>

        {/* YouTube trailer iframe */}
        {showTrailer && trailerSrc && (
          <iframe
            ref={iframeRef}
            className="fh-trailer-iframe"
            src={trailerSrc}
            allow="autoplay; encrypted-media"
            allowFullScreen={false}
            title="trailer"
          />
        )}

        <div className="fh-overlay" style={{ opacity: (showTrailer && !muted) ? 0 : 1, transition: "opacity 1s ease" }} />
      </div>

      {/* Trailer controls — top right, desktop only */}
      {showTrailer && (
        <div className="fh-trailer-controls" onClick={(e) => e.stopPropagation()}>
          <button className="fh-trailer-btn" onClick={handlePause} title={paused ? "Відтворити" : "Пауза"}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button className="fh-trailer-btn" onClick={handleMute} title={muted ? "Увімкнути звук" : "Вимкнути звук"}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      )}

      <div className="fh-content">
        {/* Desktop: two-column bottom bar */}
        <div className="fh-bottom fh-bottom--desktop">

          {/* LEFT */}
          <div className="fh-left">
            <div className="fh-titles">
              {movie?.logo_url ? (
                <>
                  <img className="fh-title-logo" src={movie.logo_url} alt={movie.title || "logo"} />
                  <div className="fh-origin">{movie?.title}</div>
                </>
              ) : (
                <>
                  <div className="fh-title">{movie?.title}</div>
                  {movie?.origin_name && <div className="fh-origin">{movie.origin_name}</div>}
                </>
              )}
            </div>

            {genreItems.length > 0 && (
              <div className="fh-genres">
                {genreItems.map((g, i) => (
                  <React.Fragment key={g}>
                    {i > 0 && <span className="fh-genre-dot">·</span>}
                    <span className="fh-genre">{g}</span>
                  </React.Fragment>
                ))}
              </div>
            )}

            {movie?.description && (
              <p className="fh-description">{movie.description}</p>
            )}

            <div className="fh-meta">
              {metaItems.map((t, i) => (
                <span key={`${t}-${i}`} className="fh-meta-item">{t}</span>
              ))}
            </div>

          </div>

          {/* RIGHT — cast/director (desktop only) */}
          {(movie?.cast?.length > 0 || movie?.director) && (
            <div className="fh-right">
              {movie.cast?.length > 0 && (
                <div className="fh-crew-row">
                  <span className="fh-crew-label">Виконавці:</span>
                  <span className="fh-crew-value">{movie.cast.join(", ")}</span>
                </div>
              )}
              {movie.director && (
                <div className="fh-crew-row">
                  <span className="fh-crew-label">Режисер:</span>
                  <span className="fh-crew-value">{movie.director}</span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </section>
  );
}
