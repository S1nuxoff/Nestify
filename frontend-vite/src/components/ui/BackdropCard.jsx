// src/components/ui/BackdropCard.jsx
import React, { useState } from "react";
import "../../styles/BackdropCard.css";

function BackdropCardInner({ movie, onMovieSelect }) {
  const [loaded, setLoaded] = useState(false);

  const img = movie.backdrop || movie.backdrop_url_original || movie.filmImage || movie.image;
  const title = movie.filmName || movie.title || "";
  const year = movie.release_date || movie.filmDecribe || "";
  const genre = Array.isArray(movie.genre) ? movie.genre[0] : (movie.genre || "");
  const sub = [year, genre].filter(Boolean).join(" · ");

  return (
    <div className="bdc-card" onClick={() => onMovieSelect?.(movie)}>
      <div className={`bdc-thumb${loaded ? " is-loaded" : ""}`}>
        <div className="bdc-skeleton" />
        {img && (
          <img
            src={img}
            alt={title}
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
        )}
        <div className="bdc-overlay" />
      </div>
      <div className="bdc-meta">
        <div className="bdc-title">{title}</div>
        {sub && <div className="bdc-sub">{sub}</div>}
      </div>
    </div>
  );
}

const BackdropCard = React.memo(BackdropCardInner);
export default BackdropCard;
