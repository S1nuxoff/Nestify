// src/components/ui/ContinueCard.jsx
import React from "react";
import { Play } from "lucide-react";
import "../../styles/ContinueCard.css";

function formatTimeLeft(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ContinueCardInner({ movie, onMovieSelect }) {
  const img = movie.backdrop || movie.filmImage || movie.image;
  const title = movie.filmName || movie.title || "";
  const year = movie.release_date || movie.filmDecribe || "";
  const genre = Array.isArray(movie.genre) ? movie.genre[0] : (movie.genre || "");

  const position = movie.position_seconds ?? movie.position ?? 0;
  const duration = movie.duration ?? movie.watch_duration ?? 0;
  const progress = duration > 0 ? Math.min((position / duration) * 100, 100) : 0;
  const timeLeft = duration > 0 ? formatTimeLeft(duration - position) : null;

  const isSeries = movie.action === "get_stream" && movie.season != null;
  const subline = isSeries
    ? `S${movie.season} · E${movie.episode}`
    : [year, genre].filter(Boolean).join(" · ");

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onMovieSelect?.(movie);
    }
  };

  return (
    <div
      className="cc-card"
      onClick={() => onMovieSelect?.(movie)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={title}
    >
      {/* Thumbnail */}
      <div className="cc-thumb">
        {img && <img src={img} alt={title} loading="lazy" />}

        {/* Play button */}
        <div className="cc-play">
          <Play size={22} fill="white" stroke="none" />
        </div>

        {/* Time left */}
        {timeLeft && <span className="cc-time">{timeLeft}</span>}

        {/* Progress bar */}
        {progress > 0 && (
          <div className="cc-progress">
            <div className="cc-progress__fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {/* Meta below */}
      <div className="cc-meta">
        <div className="cc-title">{title}</div>
        {subline && <div className="cc-sub">{subline}</div>}
      </div>
    </div>
  );
}

const ContinueCard = React.memo(ContinueCardInner);
export default ContinueCard;
