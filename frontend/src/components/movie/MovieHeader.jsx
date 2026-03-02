// src/components/movie/MovieHeader.jsx
import React, { useEffect, useMemo, useState } from "react";
import ReactPlayer from "react-player/youtube";
import { ReactComponent as CastIcon } from "../../assets/icons/cast.svg";
import { Play, Star, X, Film, Volume2, VolumeOff } from "lucide-react";

import "../../styles/MovieHeaderHero.css";

function formatTime(sec) {
  const total = Math.floor(sec || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export default function MovieHeader({
  movieDetails,
  playerOnline,
  onMainPlayClick,
  onCastClick,
}) {
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [trailerMuted, setTrailerMuted] = useState(false);

  // ✅ trailerUrl НЕ умовно — хук завжди викликається
  const trailerUrl = useMemo(() => {
    const tmdb = (movieDetails?.trailer_tmdb || "").trim();
    const rezka = (movieDetails?.trailer || "").trim();
    return tmdb || rezka || "";
  }, [movieDetails?.trailer_tmdb, movieDetails?.trailer]);

  const hasTrailer = Boolean(trailerUrl);

  // meta
  const computed = useMemo(() => {
    const year = movieDetails?.release_date
      ? String(movieDetails.release_date).split(",")[0]
      : "";

    const ratingValue = Number(movieDetails?.rate || 0);

    const lastWatch = movieDetails?.last_watch || null;
    const lastDurationSec =
      lastWatch && typeof lastWatch.duration === "number"
        ? lastWatch.duration
        : null;
    const lastPositionSec =
      lastWatch && typeof lastWatch.position_seconds === "number"
        ? lastWatch.position_seconds
        : null;

    const hasLastProgress =
      lastDurationSec && lastDurationSec > 0 && lastPositionSec != null;

    const lastPercent = hasLastProgress
      ? Math.min(lastPositionSec / lastDurationSec, 1)
      : null;

    const lastPercentDisplay =
      lastPercent != null ? Math.round(lastPercent * 100) : null;

    const isFullyWatched =
      lastPercent != null &&
      Number.isFinite(lastPercent) &&
      lastPercent >= 0.98;

    return {
      year,
      ratingValue,
      lastWatch,
      lastDurationSec,
      lastPositionSec,
      hasLastProgress,
      lastPercentDisplay,
      isFullyWatched,
    };
  }, [movieDetails]);

  // ESC close
  useEffect(() => {
    if (!trailerOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setTrailerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [trailerOpen]);

  // lock scroll when modal open
  useEffect(() => {
    if (!trailerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [trailerOpen]);

  if (!movieDetails) return null;

  const bgImage =
    movieDetails?.backdrop_url_original ||
    movieDetails?.poster_tmdb ||
    movieDetails?.image;

  const posterImage = movieDetails?.backdrop || movieDetails?.image || bgImage;

  const ratingValue = computed.ratingValue;

  const metaItems = [];
  if (computed.year) metaItems.push(computed.year);
  if (computed.lastWatch?.season)
    metaItems.push(`${computed.lastWatch.season} sezon`);
  if (movieDetails?.duration) metaItems.push(movieDetails.duration);
  if (movieDetails?.genre?.[0]) metaItems.push(movieDetails.genre[0]);

  return (
    <>
      <section className="mh-hero">
        <div className="mh-media">
          <div
            className="mh-media__bg"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <img
            className="mh-poster mh-poster--static"
            src={posterImage}
            alt=""
          />
          <div className="mh-overlay" />
        </div>

        <div className="mh-content">
          <div className="mh-bottom">
            <div className="mh-titles">
              {movieDetails?.logo_url ? (
                <img
                  className="mh-title-logo"
                  src={movieDetails.logo_url}
                  alt={movieDetails.title || "logo"}
                />
              ) : (
                <div className="mh-title">{movieDetails.title}</div>
              )}

              {!movieDetails?.logo_url && movieDetails?.origin_name && (
                <div className="mh-origin">{movieDetails.origin_name}</div>
              )}
            </div>

            <div className="mh-meta">
              {movieDetails?.age != null && (
                <span className="mh-meta-age">{movieDetails.age}</span>
              )}

              {metaItems.map((t, i) => (
                <span key={`${t}-${i}`} className="mh-meta-item">
                  {t}
                </span>
              ))}

              {Number.isFinite(ratingValue) && ratingValue > 0 && (
                <span className="mh-meta-rating">
                  <Star size={14} />
                  {ratingValue.toFixed(1)}
                </span>
              )}
            </div>

            {movieDetails?.description && (
              <div className="mh-desc">{movieDetails.description}</div>
            )}

            {computed.lastWatch && computed.hasLastProgress && (
              <div className="mh-progress">
                <div className="mh-progress__top">
                  {movieDetails.action === "get_stream" &&
                  computed.lastWatch.season &&
                  computed.lastWatch.episode ? (
                    <span className="mh-progress__label">
                      Продовжити: S{computed.lastWatch.season}E
                      {computed.lastWatch.episode}
                    </span>
                  ) : (
                    <span className="mh-progress__label">
                      Продовжити перегляд
                    </span>
                  )}

                  <span className="mh-progress__time">
                    {formatTime(computed.lastPositionSec)} /{" "}
                    {formatTime(computed.lastDurationSec)}
                  </span>
                </div>

                <div className="mh-progress__bar">
                  <div
                    className={
                      "mh-progress__fill" +
                      (computed.isFullyWatched
                        ? " mh-progress__fill--complete"
                        : "")
                    }
                    style={{ width: `${computed.lastPercentDisplay || 0}%` }}
                  />
                </div>

                <div className="mh-progress__percent">
                  {computed.isFullyWatched
                    ? "Переглянуто"
                    : `${computed.lastPercentDisplay}%`}
                </div>
              </div>
            )}

            <div className="mh-actions">
              <button
                className="mh-play tv-focusable"
                type="button"
                tabIndex={0}
                onClick={onMainPlayClick}
                aria-label="Дивитися"
              >
                <Play fill="black" /> Дивитися
              </button>

              {hasTrailer && (
                <button
                  className="mh-trailer tv-focusable"
                  type="button"
                  tabIndex={0}
                  onClick={() => setTrailerOpen(true)}
                  title="Трейлер"
                  aria-label="Трейлер"
                >
                  <Film size={18} />
                </button>
              )}

              <button
                className={`mh-cast tv-focusable ${!playerOnline ? "is-disabled" : ""}`}
                type="button"
                tabIndex={0}
                onClick={playerOnline ? onCastClick : undefined}
                title={
                  playerOnline
                    ? "Відправити на Nestify Player"
                    : "Nestify Player офлайн"
                }
                aria-label="Відправити на Nestify Player"
              >
                <CastIcon className="mh-cast__icon" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {trailerOpen && hasTrailer && (
        <div className="mh-modal" onMouseDown={() => setTrailerOpen(false)}>
          <div
            className="mh-modal__card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mh-modal__top">
              <div className="mh-modal__title">
                {movieDetails.title}
                <span className="mh-modal__sub">• трейлер</span>
              </div>

              <div className="mh-modal__actions">
                <button
                  type="button"
                  className="mh-modal__iconbtn"
                  onClick={() => setTrailerMuted((p) => !p)}
                  title={trailerMuted ? "Увімкнути звук" : "Вимкнути звук"}
                >
                  {trailerMuted ? (
                    <VolumeOff size={18} />
                  ) : (
                    <Volume2 size={18} />
                  )}
                </button>

                <button
                  type="button"
                  className="mh-modal__close"
                  onClick={() => setTrailerOpen(false)}
                  title="Закрити"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="mh-modal__player">
              <ReactPlayer
                url={trailerUrl}
                playing={true}
                muted={trailerMuted}
                controls={true}
                width="100%"
                height="100%"
                config={{
                  youtube: {
                    playerVars: {
                      autoplay: 1,
                      modestbranding: 1,
                      rel: 0,
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
