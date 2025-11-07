import React from "react";
import "../../styles/EpisodeSelectorItem.css";

function EpisodeSelector({
  episde_id,
  episde_title,
  episde_origin,
  episde_date,
  isSelected,
  onSelect,
}) {
  const containerClass = isSelected
    ? "episode-item__container selected"
    : "episode-item__container";

  // По клику вызываем onSelect с айди эпизода
  const handleClick = () => {
    if (onSelect) {
      onSelect(episde_id);
    }
  };

  return (
    <div className={containerClass} onClick={handleClick}>
      <span className="eposide-item__number">{episde_id}</span>
      <div className="episode-item-details-container">
        <div className="episode-item-title-container">
          <span className="episode-item-title">{episde_title}</span>
          <span className="episode-item-origin">{episde_origin}</span>
        </div>
        <span className="episode-item-date">{episde_date}</span>
      </div>
    </div>
  );
}

export default EpisodeSelector;
