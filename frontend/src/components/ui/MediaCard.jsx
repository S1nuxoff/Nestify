import React, { useState } from "react";
import "../../styles/MediaCard.css";
import { ReactComponent as MoreIcon } from "../../assets/icons/more.svg";

function getReadableType(type) {
  switch (type) {
    case "series":
      return "Серіал";
    case "film":
      return "Фільм";
    case "cartoon":
      return "Мультфільм";
    case "anime":
      return "Аніме";
    default:
      return "Невідомо";
  }
}

function MediaCardInner({ movie, onMovieSelect, type }) {
  const [loaded, setLoaded] = useState(false);

  const imgSrc = movie.filmImage ?? movie.image;
  const imgAlt = movie.filmName ?? movie.title ?? "Preview";

  const handleClick = () => {
    if (onMovieSelect) onMovieSelect(movie);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={
        "video-card-container tv-focusable" +
        (type === "explorer-card" ? " video-card-container-explorer" : "")
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={movie.filmName ?? movie.title ?? "Фільм"}
    >
      <div
        className={
          "video-card-preview-wrapper" +
          (type === "explorer-card"
            ? " video-card-preview-wrapper-explorer"
            : "") +
          (loaded ? " is-loaded" : " is-loading")
        }
      >
        <div className="video-card-skeleton" />

        {imgSrc && (
          <img
            src={imgSrc}
            alt={imgAlt}
            className={
              "video-card_preview-image" + (loaded ? " img-loaded" : "")
            }
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
          />
        )}

        {movie.position > 0 && movie.watch_duration > 0 && (
          <div className="video-card-progress-bar">
            <div
              className="video-card-progress-fill"
              style={{ width: `${Math.min((movie.position / movie.watch_duration) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="video-card-meta">
        {type === "history" || type === "continue" ? null : (
          <div className="movie-type">{getReadableType(movie.type)}</div>
        )}

        <span className="video-card-title">
          {movie.filmName ?? movie.title}
        </span>

        <span className="video-card-video-duration">
          {movie.filmDecribe ??
            (movie.updated_at &&
              new Date(movie.updated_at + "Z").toLocaleString("uk-UA", {
                hour: "2-digit",
                minute: "2-digit",
                year: "numeric",
                month: "short",
                day: "numeric",
              }))}
        </span>

        {movie.action === "get_stream" && (type === "history" || type === "continue") && (
          <div className="video-card-history-meta">
            <div className="movie-type">S{movie.season} · E{movie.episode}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const MediaCard = React.memo(MediaCardInner);
export default MediaCard;
