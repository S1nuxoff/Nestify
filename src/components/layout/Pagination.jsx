import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ReactComponent as BackIcon } from "../../assets/icons/back.svg";
import { ReactComponent as ForwardIcon } from "../../assets/icons/forward.svg";
import "../../styles/Pagination.css";
// Определи страницу из урла
function getCurrentPageFromPath(pathname) {
  const match = pathname.match(/\/page\/(\d+)\//);
  return match ? parseInt(match[1], 10) : 1;
}

const WINDOW = 5;

const Pagination = ({ totalPages, baseUrl }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const current = getCurrentPageFromPath(location.pathname);

  if (totalPages <= 1) return null;

  // Вычисляем текущее окно
  const windowIdx = Math.floor((current - 1) / WINDOW);
  const start = windowIdx * WINDOW + 1;
  const end = Math.min(start + WINDOW - 1, totalPages);

  // Строим массив страниц для отображения
  const pages = [];
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push("...");
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);
  }

  const goToPage = (page) => {
    if (page === "...") return;
    // Прыжок к следующему/предыдущему окну по клику на крайнее
    if (page === start && start !== 1) {
      navigateToPage(start - WINDOW > 0 ? start - WINDOW : 1);
      return;
    }
    if (page === end && end !== totalPages) {
      navigateToPage(end + 1 <= totalPages ? end + 1 : totalPages);
      return;
    }
    navigateToPage(page);
  };

  const navigateToPage = (page) => {
    const clean = baseUrl.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
    const target = page === 1 ? `${clean}/` : `${clean}/page/${page}/`;
    navigate(target);
  };

  // Назад/Вперёд
  const prev = Math.max(1, current - 1);
  const next = Math.min(totalPages, current + 1);

  return (
    <div className="pagination-container">
      <div className="pagination">
        {/* Назад */}
        <span
          className={`pagination-nav${current === 1 ? " disabled" : ""}`}
          onClick={() => current > 1 && navigateToPage(prev)}
        >
          <BackIcon className="pagination-nav_icon" />
        </span>
        {pages.map((p, i) => (
          <span
            key={i}
            className={`pagination-item ${p === current ? "active" : ""} ${
              p === "..." ? "dots" : ""
            }`}
            onClick={() => goToPage(p)}
          >
            {p}
          </span>
        ))}
        {/* Вперёд */}
        <span
          className={`pagination-nav${
            current === totalPages ? " disabled" : ""
          }`}
          onClick={() => current < totalPages && navigateToPage(next)}
        >
          <ForwardIcon className="pagination-nav_icon" />
        </span>
      </div>
      <span className="pagination-info">
        Results: {start} – {end} of {totalPages}
      </span>
    </div>
  );
};

export default Pagination;
