// src/components/movie/MovieHeader.jsx
import React, { useMemo } from "react";
import CastIcon from "../../assets/icons/cast.svg?react";
import { Play, Plus, Check, Share2, History } from "lucide-react";

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
  reactions = [],
  playerOnline,
  isLiked,
  likePending,
  onToggleLike,
  onMainPlayClick,
  onCastClick,
  resumeInfo = null,
  resumeLoading = false,
  onResumeClick = null,
}) {
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

  if (!movieDetails) return null;

  const bgImage =
    movieDetails?.backdrop_url_original ||
    movieDetails?.poster_tmdb ||
    movieDetails?.image;

  const posterImage = movieDetails?.backdrop || movieDetails?.image || bgImage;

  const ratingValue = computed.ratingValue;

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
              {movieDetails.logo_url && (
                <img className="mh-title-logo" src={movieDetails.logo_url} alt={movieDetails.title} />
              )}
              {movieDetails.logo_url ? (
                <div className="mh-origin">
                  {movieDetails.title}
                  {movieDetails?.origin_name && <> · {movieDetails.origin_name}</>}
                </div>
              ) : (
                <>
                  <div className="mh-title">{movieDetails.title}</div>
                  {movieDetails?.origin_name && (
                    <div className="mh-origin">{movieDetails.origin_name}</div>
                  )}
                </>
              )}
            </div>

            <div className="mh-meta">
              {metaItems.map((item) => (
                <span key={item.key} className="mh-meta-item">
                  {item.content}
                </span>
              ))}
            </div>

            {tagline && <div className="mh-tagline">«{tagline}»</div>}

            {reactions.length > 0 && (
              <div className="mh-reactions">
                {["fire", "nice", "think", "bore", "shit"].map((type) => {
                  const reaction = reactions.find((item) => item.type === type);
                  if (!reaction) return null;

                  const count =
                    reaction.counter >= 1000
                      ? `${(reaction.counter / 1000)
                          .toFixed(1)
                          .replace(".0", "")}K`
                      : reaction.counter;

                  return (
                    <div key={type} className="mh-reaction">
                      <img
                        src={`https://cub.rip/img/reactions/${type}.svg`}
                        alt={type}
                        className="mh-reaction__icon"
                      />
                      <span className="mh-reaction__count">{count}</span>
                    </div>
                  );
                })}
              </div>
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

            {movieDetails.description && (
              <div className="mh-desc-mobile">
                {movieDetails.description.slice(0, 160)}{movieDetails.description.length > 160 ? "…" : ""}
              </div>
            )}

            {/* Icon actions — above play buttons */}
            <div className="mh-icon-actions">
              <button
                className={`mh-icon-btn tv-focusable${isLiked ? " is-active" : ""}`}
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
                className="mh-icon-btn tv-focusable"
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
                className={`mh-icon-btn tv-focusable${!playerOnline ? " is-disabled" : ""}`}
                type="button"
                tabIndex={0}
                onClick={playerOnline ? onCastClick : undefined}
                title={playerOnline ? "Відправити на Nestify Player" : "Nestify Player офлайн"}
                aria-label="Відправити на Nestify Player"
              >
                <CastIcon style={{ width: 22, height: 22 }} />
              </button>
            </div>

            <div className="mh-actions">
              <div className="mh-play-group">
                <button
                  className="mh-play tv-focusable"
                  type="button"
                  tabIndex={0}
                  onClick={onMainPlayClick}
                  aria-label="Дивитися"
                >
                  <Play fill="black" /> Дивитися
                </button>

                {resumeInfo && onResumeClick && (
                  <button
                    className="mh-play mh-play--secondary tv-focusable"
                    type="button"
                    tabIndex={0}
                    onClick={onResumeClick}
                    disabled={resumeLoading}
                    aria-label="Продовжити перегляд"
                  >
                    {resumeLoading
                      ? <span className="mh-resume__spinner" />
                      : <History size={18} strokeWidth={2.5} />
                    }
                    з {Math.floor(resumeInfo.position_seconds / 60)} хв
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
