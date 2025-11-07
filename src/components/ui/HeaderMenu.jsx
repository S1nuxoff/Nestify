import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/HeaderMenu.css";

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

  return (
    <div className="header-menu-wrapper" ref={menuRef}>
      <ul className="header-menu">
        {categories.map((cat) => (
          <li
            key={cat.title}
            className="header-menu-item"
            onClick={() =>
              setOpenDropdown((prev) => (prev === cat.title ? null : cat.title))
            }
          >
            <span>{cat.title}</span>
          </li>
        ))}
      </ul>

      {openDropdown && (
        <ul className="dropdown">
          {categories
            .find((cat) => cat.title === openDropdown)
            ?.subcategories?.map((sub) => (
              <li
                key={sub.url}
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(null); // Закрываем дропдаун при клике
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
