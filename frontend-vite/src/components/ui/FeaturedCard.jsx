// src/components/ui/FeaturedCard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";

import "../../styles/FeaturedHeroCard.css";

export default function FeaturedCard({
  onMovieSelect,
  movie,
  isActive,
  resetTrigger,
}) {
  const [posterVisible] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  const wrapperRef = useRef(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const computed = useMemo(() => {
    const year = movie?.release_date ? String(movie.release_date).split(",")[0] : "";
    const ratingValue = Number(movie?.rate || 0);
    return { year, ratingValue };
  }, [movie]);

  if (!movie) return null;

  const bgImage = movie?.backdrop || movie?.poster_tmdb || movie?.image;
  const posterImage = movie?.backdrop || movie?.image || bgImage;

  const metaItems = [
    movie?.genres_list?.[0] || movie?.genre?.[0],
    movie?.age,
    movie?.country,
    computed.year,
  ].filter(Boolean);

  return (
    <section
      ref={wrapperRef}
      className={`fh-hero ${isActive ? "is-active" : ""}`}
      onClick={() => onMovieSelect?.(movie)}
      style={{ cursor: "pointer" }}
    >
      <div className="fh-media">
        <div className="fh-media__bg" style={{ backgroundImage: `url(${bgImage})` }} />

        <div className="fh-poster-wrap">
          <img
            className="fh-poster"
            src={posterImage}
            alt=""
            style={{ opacity: posterVisible ? 0.92 : 0, transition: "opacity 1s ease-in-out", zIndex: 2 }}
          />
        </div>

        <div className="fh-overlay" />
      </div>

      <div className="fh-content">
        <div className="fh-bottom">
          <div className="fh-titles">
            {movie?.logo_url ? (
              <>
                <img className="fh-title-logo" src={movie.logo_url} alt={movie.title || "logo"} />
                <div className="fh-origin">{movie?.title}</div>
              </>
            ) : (
              <>
                <div className="fh-title">{movie?.title}</div>
                {movie?.origin_name && (
                  <div className="fh-origin">{movie.origin_name}</div>
                )}
              </>
            )}
          </div>

          <div className="fh-meta">
            {metaItems.map((t, i) => (
              <span key={`${t}-${i}`} className="fh-meta-item">{t}</span>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
