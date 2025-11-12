import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/HeaderMenu.css";

import { ReactComponent as MoviesIcon } from "../../assets/icons/movies.svg";
import { ReactComponent as SeriesIcon } from "../../assets/icons/series.svg";
import { ReactComponent as CartoonsIcon } from "../../assets/icons/cartoons.svg";
import { ReactComponent as AnimeIcon } from "../../assets/icons/anime.svg";

const ICON_MAP = {
  Фільми: MoviesIcon,
  Фильмы: MoviesIcon,
  Серіали: SeriesIcon,
  Сериалы: SeriesIcon,
  Мультфільми: CartoonsIcon,
  Мультфильмы: CartoonsIcon,
  Аніме: AnimeIcon,
  Аниме: AnimeIcon,
};

function HeaderMenu({ categories = [], onMenuSelect }) {
  const navigate = useNavigate();
  const [openDropdown, setOpenDropdown] = useState(null);
  const menuRef = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const items = useMemo(
    () =>
      categories.map((cat) => ({ ...cat, _Icon: ICON_MAP[cat.title] || null })),
    [categories]
  );

  const current = items.find((c) => c.title === openDropdown);

  return (
    <div
      className={`header-menu-wrapper ${openDropdown ? "is-open" : ""}`}
      ref={menuRef}
    >
      <ul className="header-menu">
        {items.map((cat) => (
          <li
            key={cat.title}
            className={`header-menu-item ${
              openDropdown === cat.title ? "is-active" : ""
            }`}
            onClick={() =>
              setOpenDropdown((prev) => (prev === cat.title ? null : cat.title))
            }
            aria-expanded={openDropdown === cat.title}
          >
            {cat._Icon ? <cat._Icon className="header-menu-icon" /> : null}
            <span>{cat.title}</span>
          </li>
        ))}
      </ul>

      {/* Backdrop щоб при кліку поза дропдауном закривалось прицільно */}
      {openDropdown && (
        <div className="menu-backdrop" onClick={() => setOpenDropdown(null)} />
      )}

      {openDropdown && (
        <ul className="dropdown" role="menu" aria-label={openDropdown}>
          {current?.subcategories?.map((sub, idx) => (
            <li
              key={sub.url}
              className="dropdown-item"
              style={{ "--i": idx }} // для ступінчатої затримки
              onClick={(e) => {
                e.stopPropagation();
                setOpenDropdown(null);
                navigate(`/category${sub.url}`);
              }}
            >
              {sub.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HeaderMenu;
