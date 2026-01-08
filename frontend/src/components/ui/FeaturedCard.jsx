// src/components/ui/FeaturedCard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { Play, Star, Volume2, VolumeOff } from "lucide-react";

import "../../styles/FeaturedHeroCard.css";

function formatTime(sec) {
  const total = Math.floor(sec || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export default function FeaturedCard({
  onMovieSelect,
  movie,
  isActive,
  resetTrigger, // можно не передавать, но оставил совместимость
}) {
  const [isMuted, setIsMuted] = useState(true);
  const [posterVisible, setPosterVisible] = useState(true);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  const trailerUrl = movie?.trailer_tmdb || movie?.trailer || null;
  const hasTrailer = Boolean(trailerUrl);

  const wrapperRef = useRef(null);

  // 1) IntersectionObserver: играем только когда карточка реально на экране
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

  // 2) Сброс состояния при смене активного слайда (если resetTrigger передают)
  useEffect(() => {
    setIsMuted(true);
    setPosterVisible(true);
    setTrailerVisible(false);
    setContentVisible(true);
  }, [resetTrigger]);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    setContentVisible((prev) => !prev);
  };

  // 3) Таймеры появления трейлера только на активной карточке
  useEffect(() => {
    if (isActive && hasTrailer) {
      setPosterVisible(true);
      setTrailerVisible(false);
      setContentVisible(true);

      const hidePosterTimer = setTimeout(() => setPosterVisible(false), 5000);
      const showTrailerTimer = setTimeout(() => setTrailerVisible(true), 6000);

      return () => {
        clearTimeout(hidePosterTimer);
        clearTimeout(showTrailerTimer);
      };
    }

    // если не активная — всегда показываем постер, трейлер не грузим
    setPosterVisible(true);
    setTrailerVisible(false);
    setContentVisible(true);
  }, [isActive, hasTrailer]);

  const computed = useMemo(() => {
    const year = movie?.release_date
      ? String(movie.release_date).split(",")[0]
      : "";
    const ratingValue = Number(movie?.rate || 0);

    const metaItems = [];
    if (year) metaItems.push(year);
    if (movie?.duration) metaItems.push(movie.duration);
    if (movie?.genre?.[0]) metaItems.push(movie.genre[0]);

    return { year, ratingValue, metaItems };
  }, [movie]);

  if (!movie) return null;

  // ⚠️ у тебя в БД поля: backdrop, poster_tmdb, logo_url
  const bgImage = movie?.backdrop || movie?.poster_tmdb || movie?.image;
  const posterImage = movie?.backdrop || movie?.image || bgImage;

  // 4) Ключ: монтируем ReactPlayer только когда реально надо (сильно снижает лаги)
  const shouldPlayTrailer =
    hasTrailer && isActive && isVisible && trailerVisible;

  return (
    <section
      ref={wrapperRef}
      className={`fh-hero ${isActive ? "is-active" : ""} ${
        !isMuted ? "is-unmuted" : ""
      }`}
    >
      <div className="fh-media">
        <div
          className="fh-media__bg"
          style={{ backgroundImage: `url(${bgImage})` }}
        />

        <div className="fh-poster-wrap">
          <img
            className="fh-poster"
            src={posterImage}
            alt=""
            style={{
              opacity: posterVisible ? 0.92 : 0,
              transition: "opacity 1s ease-in-out",
              zIndex: 2,
            }}
          />

          {shouldPlayTrailer && (
            <>
              <ReactPlayer
                url={trailerUrl}
                playing={true}
                muted={isMuted}
                controls={false}
                loop
                playsinline
                width="100%"
                height="100%"
                className="fh-youtube"
                config={{
                  youtube: {
                    playerVars: {
                      autoplay: 1,
                      playsinline: 1,
                      mute: 1,
                      modestbranding: 1,
                      rel: 0,
                      controls: 0,
                      fs: 0,
                      disablekb: 1,
                    },
                  },
                }}
              />

              <button
                type="button"
                className="fh-volume"
                onClick={toggleMute}
                title={isMuted ? "Увімкнути звук" : "Вимкнути звук"}
              >
                {isMuted ? <VolumeOff size={22} /> : <Volume2 size={22} />}
              </button>
            </>
          )}
        </div>

        <div
          className="fh-overlay"
          style={{
            opacity: contentVisible ? 1 : 0.15,
            transition: "opacity 0.6s ease-in-out",
          }}
        />
      </div>

      <div
        className="fh-content"
        style={{
          opacity: contentVisible ? 1 : 0,
          transition: "opacity 0.6s ease-in-out",
        }}
      >
        <div className="fh-bottom">
          <div className="fh-titles">
            {movie?.logo_url ? (
              <img
                className="fh-title-logo"
                src={movie.logo_url}
                alt={movie.title || "logo"}
              />
            ) : (
              <div className="fh-title">{movie?.title}</div>
            )}

            {!movie?.logo_url && (movie?.origin_name || movie?.title) && (
              <div className="fh-origin">
                {movie?.origin_name || movie?.title}
              </div>
            )}
          </div>

          <div className="fh-meta">
            {movie?.age != null && (
              <span className="fh-meta-age">{movie.age}</span>
            )}

            {computed.metaItems.map((t, i) => (
              <span key={`${t}-${i}`} className="fh-meta-item">
                {t}
              </span>
            ))}

            {Number.isFinite(computed.ratingValue) &&
              computed.ratingValue > 0 && (
                <span className="fh-meta-rating">
                  <Star size={14} />
                  {computed.ratingValue.toFixed(1)}
                </span>
              )}
          </div>

          {movie?.description && (
            <div className="fh-desc">{movie.description}</div>
          )}

          <div className="fh-actions">
            <button
              className="fh-play"
              type="button"
              onClick={() => onMovieSelect?.(movie)}
            >
              <Play fill="black" /> Дивитися
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
