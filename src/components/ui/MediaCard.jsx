import React from "react";
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

function MediaCard({ movie, onMovieSelect, type }) {
  return (
    <div
      className={
        "video-card-container" +
        (type === "explorer-card" ? " video-card-container-explorer" : "")
      }
      onClick={() => onMovieSelect(movie)}
    >
      <div
        className={
          `video-card-preview-wrapper` +
          (type === "explorer-card"
            ? " video-card-preview-wrapper-explorer"
            : "")
        }
      >
        <img
          src={movie.filmImage ?? movie.image}
          alt="Preview"
          className="video-card_preview-image"
        />
        <div className="video-card-more-btn-container">
          <MoreIcon className="video-card-more-btn" />
        </div>
      </div>
      {/* <MoreIcon /> */}
      <div className="video-card-meta">
        {type === "history" ? (
          ""
        ) : (
          <div className="movie-type">{getReadableType(movie.type)}</div>
        )}
        <span className="video-card-title">
          {movie.filmName ?? movie.title}
        </span>

        <span className="video-card-video-duration">
          {movie.filmDecribe ??
            new Date(movie.updated_at + "Z").toLocaleString("uk-UA", {
              hour: "2-digit",
              minute: "2-digit",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
        </span>
        {movie.action === "get_stream" ? (
          type === "history" ? (
            <div className="video-card-history-meta">
              <div className="movie-type">Season: {movie.season}</div>
              <div className="movie-type">Episode: {movie.episode}</div>
            </div>
          ) : null
        ) : null}
      </div>
    </div>
  );
}

export default MediaCard;
