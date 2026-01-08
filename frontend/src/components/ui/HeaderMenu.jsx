// src/components/ui/HeaderMenu.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/HeaderMenu.css";

function HeaderMenu({ categories = [] }) {
  const navigate = useNavigate();

  const items = useMemo(
    () => categories.map((cat) => ({ ...cat })),
    [categories]
  );

  return (
    <div className="header-menu-wrapper">
      <ul className="header-menu">
        {items.map((cat) => (
          <li
            key={cat.title}
            className="header-menu-item"
            onClick={() => navigate(`/browse/${encodeURIComponent(cat.title)}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                navigate(`/browse/${encodeURIComponent(cat.title)}`);
            }}
          >
            <span>{cat.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HeaderMenu;
