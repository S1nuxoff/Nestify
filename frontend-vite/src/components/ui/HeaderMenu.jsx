import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/HeaderMenu.css";

const PICKER_SEEN_KEY = "nestify_picker_seen";

const TMDB_CATEGORIES = [
  { title: "Фільми",      path: "/catalog/movies" },
  { title: "Серіали",     path: "/catalog/series" },
  { title: "Мультфільми", path: "/catalog/animation" },
  { title: "Аніме",       path: "/catalog/anime" },
];

function HeaderMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pickerSeen] = useState(() => !!localStorage.getItem(PICKER_SEEN_KEY));

  return (
    <div className="header-menu-wrapper">
      <ul className="header-menu">
        <li
          className="header-menu-item"
          onClick={() => navigate("/feed")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") navigate("/feed"); }}
        >
          <span>Підбір</span>
          {!pickerSeen && <span className="header-menu-new-badge">NEW</span>}
        </li>

        {TMDB_CATEGORIES.map((cat) => (
          <li
            key={cat.path}
            className={`header-menu-item${location.pathname === cat.path ? " is-active" : ""}`}
            onClick={() => navigate(cat.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") navigate(cat.path); }}
          >
            <span>{cat.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HeaderMenu;
