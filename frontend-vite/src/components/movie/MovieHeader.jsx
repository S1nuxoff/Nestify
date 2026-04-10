// src/components/movie/MovieHeader.jsx
import React, { useMemo } from "react";
import CastIcon from "../../assets/icons/cast.svg?react";
import { Play, Plus, Check, Share2 } from "lucide-react";

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
  tagline = "",
  playerOnline,
  isLiked,
  likePending,
  onToggleLike,
  onMainPlayClick,
  onCastClick,
}) {
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

  if (!movieDetails) return null;

  const bgImage =
    movieDetails?.backdrop_url_original ||
    movieDetails?.poster_tmdb ||
    movieDetails?.image;

  const posterImage = movieDetails?.backdrop || movieDetails?.image || bgImage;

  const metaItems = [];
  if (movieDetails?.release_date) {
    metaItems.push({ key: "year", content: computed.year });
  }
  if (movieDetails?.age != null) {
    metaItems.push({
      key: "age",
      content: <span className="mh-meta-age">{movieDetails.age}</span>,
    });
  }
  if (movieDetails?.genre?.length) {
    metaItems.push({ key: "genre", content: movieDetails.genre[0] });
  }
  if (movieDetails?.studios?.length) {
    metaItems.push({ key: "studio", content: movieDetails.studios[0] });
  }

  const genreItems = (movieDetails?.genre || []).slice(0, 3);

  const castNames = (movieDetails?.actors || []).slice(0, 4).map((a) => a.name);
  const directorNames = movieDetails?.director_names || [];

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

            {/* LEFT column */}
            <div className="mh-left">
              <div className="mh-titles">
                {movieDetails.logo_url ? (
                  <>
                    <img className="mh-title-logo" src={movieDetails.logo_url} alt={movieDetails.title} />
                    <div className="mh-origin mh-origin--under-logo">{movieDetails.title}</div>
                  </>
                ) : (
                  <>
                    <div className="mh-title">{movieDetails.title}</div>
                    {movieDetails?.origin_name && (
                      <div className="mh-origin">{movieDetails.origin_name}</div>
                    )}
                  </>
                )}
              </div>

              {/* genres — desktop only */}
              {genreItems.length > 0 && (
                <div className="mh-genres">
                  {genreItems.map((g, i) => (
                    <React.Fragment key={g}>
                      {i > 0 && <span className="mh-genre-dot">·</span>}
                      <span className="mh-genre">{g}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              <div className="mh-meta">
                {metaItems.map((item) => (
                  <span key={item.key} className="mh-meta-item">
                    {item.content}
                  </span>
                ))}
              </div>

              {tagline && <div className="mh-tagline">«{tagline}»</div>}

              {computed.lastWatch && computed.hasLastProgress && (
                <div className="mh-progress">
                  <div className="mh-progress__top">
                    {movieDetails.action === "get_stream" &&
                    computed.lastWatch.season &&
                    computed.lastWatch.episode ? (
                      <span className="mh-progress__label">
                        Продовжити: S{computed.lastWatch.season}E{computed.lastWatch.episode}
                      </span>
                    ) : (
                      <span className="mh-progress__label">Продовжити перегляд</span>
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
                        (computed.isFullyWatched ? " mh-progress__fill--complete" : "")
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

              <div className="mh-btn-row">
              <div className="mh-actions">
                <button
                  className="mh-play"
                  type="button"
                  tabIndex={0}
                  onClick={onMainPlayClick}
                  aria-label="Дивитися"
                >
                  <Play fill="black" /> Дивитися
                </button>
              </div>
              <div className="mh-icon-actions">
                <button
                  className={`mh-icon-btn${isLiked ? " is-active" : ""}`}
                  type="button"
                  tabIndex={0}
                  onClick={onToggleLike}
                  disabled={likePending}
                  title={isLiked ? "Видалити зі списку" : "Додати до списку"}
                  aria-label={isLiked ? "Видалити зі списку" : "Додати до списку"}
                >
                  {isLiked ? <Check size={22} strokeWidth={2.5} /> : <Plus size={22} strokeWidth={2.5} />}
                </button>

                <button
                  className="mh-icon-btn"
                  type="button"
                  tabIndex={0}
                  onClick={() => {
                    const url = window.location.href;
                    if (navigator.share) {
                      navigator.share({ title: movieDetails?.title || "", url });
                    } else {
                      navigator.clipboard?.writeText(url);
                    }
                  }}
                  title="Поділитися"
                  aria-label="Поділитися"
                >
                  <Share2 size={22} strokeWidth={2} />
                </button>

                <button
                  className={`mh-icon-btn${!playerOnline ? " is-disabled" : ""}`}
                  type="button"
                  tabIndex={0}
                  onClick={playerOnline ? onCastClick : undefined}
                  title={playerOnline ? "Відправити на Nestify Player" : "Nestify Player офлайн"}
                  aria-label="Відправити на Nestify Player"
                >
                  <CastIcon style={{ width: 22, height: 22 }} />
                </button>
              </div>

              </div>{/* end mh-btn-row */}
            </div>

            {/* RIGHT column — desktop only */}
            {(castNames.length > 0 || directorNames.length > 0) && (
              <div className="mh-right">
                {castNames.length > 0 && (
                  <div className="mh-crew-row">
                    <span className="mh-crew-label">Виконавці:</span>
                    <span className="mh-crew-value">{castNames.join(", ")}</span>
                  </div>
                )}
                {directorNames.length > 0 && (
                  <div className="mh-crew-row">
                    <span className="mh-crew-label">Режисер:</span>
                    <span className="mh-crew-value">{directorNames.join(", ")}</span>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </section>
    </>
  );
}
