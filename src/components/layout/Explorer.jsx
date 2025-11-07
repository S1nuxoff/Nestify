import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import MediaCard from "../ui/MediaCard";
import "swiper/css";
import "../../styles/Explorer.css";
import { ReactComponent as BackIcon } from "../../assets/icons/back.svg";

function Explorer({ history, title, Page, onMovieSelect }) {
  const [visibleCount] = useState(100);
  const navigate = useNavigate(); // <-- хук ТУТ, всередині компонента

  return (
    <div className="explorer-container">
      <div className="category-content-title">
        <BackIcon
          style={{ cursor: "pointer" }}
          onClick={() => navigate(-1)} // ⬅ назад
        />

        <span className="row-header-title">{title}</span>
      </div>

      <div className="explorer-library-grid">
        {Page &&
          Page.slice(0, visibleCount).map((movie) => (
            <MediaCard
              key={movie.id || movie.filmId || movie.link}
              movie={movie}
              onMovieSelect={onMovieSelect}
              type="explorer-card"
            />
          ))}
      </div>
    </div>
  );
}

export default Explorer;
