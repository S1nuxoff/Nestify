// src/components/movie/MovieHeader.jsx
import React, { useState } from "react";
import { ReactComponent as CastIcon } from "../../assets/icons/cast.svg";
import "../../styles/MoviePage.css";
import { ReactComponent as PlayIcon } from "../../assets/icons/play.svg";
function formatTime(sec) {
  const total = Math.floor(sec || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

const MovieHeader = ({
  movieDetails,
  playerOnline,
  onMainPlayClick,
  onCastClick,
}) => {
  const [posterLoaded, setPosterLoaded] = useState(false);

  if (!movieDetails) return null;

  const mainCountry = Array.isArray(movieDetails.country)
    ? movieDetails.country[0]
    : movieDetails.country;

  const year = movieDetails.release_date
    ? movieDetails.release_date.split(",")[0]
    : "";

  const genresText = Array.isArray(movieDetails.genre)
    ? movieDetails.genre.join(" | ")
    : movieDetails.genre;

  // ---------- прогресс просмотра из last_watch ----------
  const lastWatch = movieDetails.last_watch || null;
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
    lastPercent != null && Number.isFinite(lastPercent) && lastPercent >= 0.98;

  return (
    <section className="movie-page__header">
      <div className="movie-page__bg"></div>
      <div className=""></div>

      <div className="movie-page__header-inner">
        <div className="movie-page__poster-card">
          <img
            src={movieDetails.image}
            alt={movieDetails.title}
            className={
              "movie-page__poster-img " +
              (posterLoaded
                ? "movie-page__poster-img--loaded"
                : "movie-page__poster-img--loading")
            }
            onLoad={() => setPosterLoaded(true)}
          />
        </div>

        <div className="movie-page__header-details">
          <div className="movie-page__meta-top">
            {(year || mainCountry) && (
              <span className="movie-page__year-country">
                {year}
                {year && mainCountry ? ", " : ""}
                {mainCountry}
              </span>
            )}
          </div>

          <h1 className="movie-page__title">{movieDetails.title}</h1>

          <div className="movie-page__chips">
            <div className="movie-page__chip movie-page__chip-rating">
              <span className="movie-page__chip-value">
                {Math.round(movieDetails.rate)}
              </span>
              <span className="movie-page__chip-label">TMDB</span>
            </div>

            {movieDetails.age !== null && (
              <div className="movie-page__chip">{movieDetails.age}</div>
            )}

            <div className="movie-page__chip movie-page__chip-status">
              Випущено
            </div>
          </div>

          <div className="movie-page__subinfo">
            {movieDetails.duration && <span>{movieDetails.duration}</span>}
            {movieDetails.duration && genresText && (
              <span className="movie-page__dot">•</span>
            )}
            {genresText && <span>{genresText}</span>}
          </div>

          {/* прогресс просмотра фильма / епізоду */}
          {lastWatch && hasLastProgress && (
            <div className="movie-page__progress">
              <div className="movie-page__progress-top">
                {movieDetails.action === "get_stream" &&
                lastWatch.season &&
                lastWatch.episode ? (
                  <span className="movie-page__progress-label">
                    Продовжити: S{lastWatch.season}E{lastWatch.episode}
                  </span>
                ) : (
                  <span className="movie-page__progress-label">
                    Продовжити перегляд
                  </span>
                )}

                <span className="movie-page__progress-time">
                  {formatTime(lastPositionSec)} / {formatTime(lastDurationSec)}
                </span>
              </div>

              <div className="movie-page__progress-bar">
                <div
                  className={
                    "movie-page__progress-bar-inner" +
                    (isFullyWatched
                      ? " movie-page__progress-bar-inner--completed"
                      : "")
                  }
                  style={{
                    width: `${lastPercentDisplay || 0}%`,
                  }}
                />
              </div>

              <span className="movie-page__progress-percent">
                {isFullyWatched ? "Переглянуто" : `${lastPercentDisplay}%`}
              </span>
            </div>
          )}

          <div className="movie-page__controls">
            <div className="movie-page__controls-left">
              {/* умный Play в браузере */}
              <div
                className="movie-page__play-button"
                onClick={onMainPlayClick}
              >
                <PlayIcon /> Дивитися
              </div>

              {/* Cast → або last_watch, або попап */}
              <CastIcon
                className={
                  "movie-page__cast-button" + (!playerOnline ? " disabled" : "")
                }
                onClick={playerOnline ? onCastClick : undefined}
                title={
                  playerOnline
                    ? "Відправити на Nestify Player"
                    : "Nestify Player офлайн"
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MovieHeader;
