// components/ui/EpisodeSelector.jsx
import React from "react";
import "../../styles/EpisodeSelectorItem.css";

function EpisodeSelector({
  index = 0, // ← для stagger
  isLoaded = true, // ← коли список готовий
  episde_id,
  episde_title,
  episde_origin,
  episde_date,
  isSelected,
  isWatched,
  progressPercent, // 0–100 або null
  onSelect,
}) {
  const containerClass = [
    "episode-item__container",
    isSelected ? "selected" : "",
    isWatched ? "completed" : "",
    isLoaded ? "in" : "pre", // ← класи для анімації
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => onSelect?.(episde_id);

  const hasProgress =
    typeof progressPercent === "number" && progressPercent > 0;
  const clampedPercent = hasProgress
    ? Math.min(Math.max(progressPercent, 0), 100)
    : 0;

  return (
    <div
      className={containerClass}
      onClick={handleClick}
      style={{ "--i": index }} // ← затримка для кожного елемента
    >
      <span className="eposide-item__number">{episde_id}</span>

      <div className="episode-item-details-container">
        <div className="episode-item-main">
          <div className="episode-item-title-container">
            <span className="episode-item-title">{episde_title}</span>
            <span className="episode-item-origin">{episde_origin}</span>
          </div>
        </div>

        <div className="episode-item-meta-right">
          <span className="episode-item-date">{episde_date}</span>
          {hasProgress && (
            <span
              className={
                "episode-item-status" + (isWatched ? " status-completed" : "")
              }
            >
              {isWatched ? "Переглянуто" : `${Math.round(clampedPercent)}%`}
            </span>
          )}
        </div>

        {hasProgress && (
          <div className="episode-item-progress">
            <div
              className={
                "episode-item-progress-inner" +
                (isWatched ? " episode-item-progress-inner--done" : "")
              }
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default EpisodeSelector;
