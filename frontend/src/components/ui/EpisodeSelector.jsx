import React from "react";
import { Play, CheckCircle2 } from "lucide-react";
import "../../styles/EpisodeSelectorItem.css";

const ProgressCircle = ({ percent, isWatched }) => {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="progress-ring-container">
      <svg width="32" height="32">
        {/* Фоновый круг */}
        <circle
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="2.5"
          fill="transparent"
          r={radius}
          cx="16"
          cy="16"
        />
        {/* Прогресс */}
        <circle
          className="progress-ring-circle"
          stroke={isWatched ? "var(--accent-success)" : "var(--white)"}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
          fill="transparent"
          r={radius}
          cx="16"
          cy="16"
        />
      </svg>
    </div>
  );
};

function EpisodeSelector({
  index = 0,
  isLoaded = true,
  episde_id,
  episde_title,
  episde_origin,
  episde_date,
  isSelected,
  isWatched,
  progressPercent = 0,
  onSelect,
}) {
  const containerClass = [
    "episode-item__container",
    isSelected ? "selected" : "",
    isWatched ? "completed" : "",
    isLoaded ? "in" : "pre",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={containerClass + " tv-focusable"}
      onClick={() => onSelect?.(episde_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(episde_id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Серія ${episde_id}${episde_title ? ': ' + episde_title : ''}`}
      aria-pressed={isSelected}
      style={{ "--i": index }}
    >
      <div className="eposide-item__number">
        {isSelected ? (
          <Play size={20} fill="currentColor" stroke="none" />
        ) : (
          episde_id
        )}
      </div>

      <div className="episode-item-details-container">
        <div className="episode-item-main">
          <span className="episode-item-title">{episde_title}</span>
          <span className="episode-item-origin">{episde_origin}</span>
        </div>

        <div className="episode-item-meta-right">
          <span className="episode-item-date">{episde_date}</span>

          {isWatched ? (
            <CheckCircle2
              size={22}
              color="var(--accent-success)"
              strokeWidth={2.5}
            />
          ) : (
            <ProgressCircle percent={progressPercent} isWatched={isWatched} />
          )}
        </div>
      </div>
    </div>
  );
}

export default EpisodeSelector;
