import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/HeaderMenu.css";

const PICKER_SEEN_KEY = "nestify_picker_seen";

function HeaderMenu({ categories = [] }) {
  const navigate = useNavigate();
  const [pickerSeen] = useState(() => !!localStorage.getItem(PICKER_SEEN_KEY));

  const items = useMemo(
    () => categories.map((cat) => ({ ...cat })),
    [categories]
  );

  return (
    <div className="header-menu-wrapper">
      <ul className="header-menu">
        <li
          className="header-menu-item"
          onClick={() => navigate("/feed")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") navigate("/pick"); }}
        >
          <span>Підбір</span>
          {!pickerSeen && <span className="header-menu-new-badge">NEW</span>}
        </li>
        {items.map((cat) => (
          <li
            key={cat.title}
            className="header-menu-item"
            onClick={() => navigate(`/browse/${encodeURIComponent(cat.title)}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigate(`/browse/${encodeURIComponent(cat.title)}`);
              }
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
