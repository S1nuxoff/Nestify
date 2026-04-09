// Explorer.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MediaCard from "../ui/MediaCard";
import "swiper/css";
import "../../styles/Explorer.css";
import "../../styles/Pagination.css";
import BackIcon from "../../assets/icons/back.svg?react";
import ForwardIcon from "../../assets/icons/forward.svg?react";
import StickyCategoryHeader from "../ui/StickyCategoryHeader";

const PAGE_SIZE = 40;
const WINDOW = 5;

function ExplorerPagination({ current, total, onChange }) {
  if (total <= 1) return null;

  const windowIdx = Math.floor((current - 1) / WINDOW);
  const start = windowIdx * WINDOW + 1;
  const end = Math.min(start + WINDOW - 1, total);

  const pages = [];
  if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total) { if (end < total - 1) pages.push("..."); pages.push(total); }

  const go = (p) => {
    if (p === "..." || p < 1 || p > total) return;
    onChange(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="pagination-container">
      <div className="pagination">
        <span className={`pagination-nav${current === 1 ? " disabled" : ""}`} onClick={() => go(current - 1)}>
          <BackIcon className="pagination-nav_icon" />
        </span>
        {pages.map((p, i) => (
          <span
            key={i}
            className={`pagination-item${p === current ? " active" : ""}${p === "..." ? " dots" : ""}`}
            onClick={() => go(p)}
          >
            {p}
          </span>
        ))}
        <span className={`pagination-nav${current === total ? " disabled" : ""}`} onClick={() => go(current + 1)}>
          <ForwardIcon className="pagination-nav_icon" />
        </span>
      </div>
    </div>
  );
}

function Explorer({ history, title, Page, onMovieSelect, headerExtra, paginate = false, cardType = "explorer-card" }) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);

  const headerRef = useRef(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const STICKY_OFFSET = 32;
    const isSmallScreen = () => window.innerWidth < 1650;
    let enabled = isSmallScreen();

    const handleScroll = () => {
      if (!enabled) { if (isStuck) setIsStuck(false); return; }
      const rect = el.getBoundingClientRect();
      setIsStuck(rect.top <= STICKY_OFFSET);
    };

    const handleResize = () => { enabled = isSmallScreen(); handleScroll(); };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [isStuck]);

  const items = Page || [];
  const totalPages = paginate ? Math.ceil(items.length / PAGE_SIZE) : 1;
  const visible = paginate
    ? items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : items;

  return (
    <div className="explorer-container">
      <StickyCategoryHeader title={title} onBack={() => navigate(-1)} />
      {headerExtra}

      <div className="explorer-library-grid">
        {visible.map((movie) => (
          <MediaCard
            key={`${movie.id}-${movie.season}-${movie.episode}`}
            movie={movie}
            onMovieSelect={onMovieSelect}
            type={cardType}
          />
        ))}
      </div>

      {paginate && (
        <ExplorerPagination
          current={currentPage}
          total={totalPages}
          onChange={setCurrentPage}
        />
      )}
    </div>
  );
}

export default Explorer;
