import React, { useState } from "react";
import "../../styles/MediaCard.css";
import MoreIcon from "../../assets/icons/more.svg?react";

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
  const imgSrc = movie.filmImage ?? movie.image;
  const [loaded, setLoaded] = useState(!imgSrc);
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
        "video-card-container" +
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

        {imgSrc ? (
          <img
            src={imgSrc}
            alt={imgAlt}
            className={
              "video-card_preview-image" + (loaded ? " img-loaded" : "")
            }
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={(e) => { e.currentTarget.style.display = "none"; setLoaded(true); }}
          />
        ) : (
          <div className="video-card-no-image">
            <span className="video-card-no-image__title">{movie.filmName ?? movie.title ?? ""}</span>
          </div>
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
        <span className="video-card-title">
          {movie.filmName ?? movie.title}
        </span>

        <span className="video-card-video-duration">
          {[
            movie.filmDecribe ?? (movie.updated_at && (() => {
              const d = new Date(movie.updated_at + "Z");
              return isNaN(d) ? null : d.toLocaleString("uk-UA", {
                hour: "2-digit",
                minute: "2-digit",
                year: "numeric",
                month: "short",
                day: "numeric",
              });
            })()),
            Array.isArray(movie.genre) ? movie.genre[0] : movie.genre,
          ].filter(Boolean).join(" · ")}
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
