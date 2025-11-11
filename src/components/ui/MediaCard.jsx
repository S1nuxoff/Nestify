import React, { useState } from "react";
import "../../styles/MediaCard.css";
import { ReactComponent as MoreIcon } from "../../assets/icons/more.svg";

function getReadableType(type) {
  switch (type) {
    case "series":
      return "Сериал";
    case "film":
      return "Фильм";
    case "cartoon":
      return "Мультфильм";
    case "anime":
      return "Аниме";
    default:
      return "Неизвестно";
  }
}

function MediaCardInner({ movie, onMovieSelect, type }) {
  const [loaded, setLoaded] = useState(false);

  const imgSrc = movie.filmImage ?? movie.image;
  const imgAlt = movie.filmName ?? movie.title ?? "Preview";

  const handleClick = () => {
    if (onMovieSelect) onMovieSelect(movie);
  };

  return (
    <div
      className={
        "video-card-container" +
        (type === "explorer-card" ? " video-card-container-explorer" : "")
      }
      onClick={handleClick}
    >
      <div
        className={
          `video-card-preview-wrapper` +
          (type === "explorer-card"
            ? " video-card-preview-wrapper-explorer"
            : "") +
          (loaded ? " is-loaded" : " is-loading")
        }
      >
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

        <div className="video-card-more-btn-container">
          <MoreIcon className="video-card-more-btn" />
        </div>
      </div>

      <div className="video-card-meta">
        {type === "history" ? null : (
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

        {movie.action === "get_stream" && type === "history" && (
          <div className="video-card-history-meta">
            <div className="movie-type">Season: {movie.season}</div>
            <div className="movie-type">Episode: {movie.episode}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const MediaCard = React.memo(MediaCardInner);
export default MediaCard;
