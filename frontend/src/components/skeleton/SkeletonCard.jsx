import React from "react";
import "../../styles/HomePage.css";

const HomeSkeleton = () => {
  const rows = [1, 2, 3];

  return (
    <div className="home-skeleton">
      {/* Hero / Featured */}
      <div className="home-skeleton-featured">
        <div className="skeleton skeleton-badge" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-subtitle" />
        <div className="home-skeleton-buttons">
          <div className="skeleton skeleton-btn" />
          <div className="skeleton skeleton-btn secondary" />
        </div>
      </div>

      {/* Ряды контента */}
      {rows.map((row) => (
        <div key={row} className="home-skeleton-row">
          <div className="skeleton skeleton-row-title" />
          <div className="home-skeleton-cards">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-card" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HomeSkeleton;
