// Explorer.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MediaCard from "../ui/MediaCard";
import "swiper/css";
import "../../styles/Explorer.css";
import { ReactComponent as BackIcon } from "../../assets/icons/back.svg";
import StickyCategoryHeader from "../ui/StickyCategoryHeader";

function Explorer({ history, title, Page, onMovieSelect }) {
  const [visibleCount] = useState(100);
  const navigate = useNavigate();

  const headerRef = useRef(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const STICKY_OFFSET = 32; // ≈ top, при котором считаем "прилип"
    const isSmallScreen = () => window.innerWidth < 1650;

    let enabled = isSmallScreen();

    const handleScroll = () => {
      if (!enabled) {
        if (isStuck) setIsStuck(false);
        return;
      }

      const rect = el.getBoundingClientRect();
      const stuckNow = rect.top <= STICKY_OFFSET;
      setIsStuck(stuckNow);
    };

    const handleResize = () => {
      enabled = isSmallScreen();
      handleScroll();
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [isStuck]);

  const handleScrollTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="explorer-container">
      {/* новый рядок: капсула + кнопка вверх */}
      <StickyCategoryHeader title={title} onBack={() => navigate(-1)} />

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
