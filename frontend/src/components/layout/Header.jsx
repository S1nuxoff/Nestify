import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMediaQuery } from "react-responsive";
import { ReactComponent as Logo } from "../../assets/icons/logo_colored.svg";
import { ReactComponent as SettingsIcon } from "../../assets/icons/settings.svg";
import { ReactComponent as ExitIcon } from "../../assets/icons/exit.svg";
import HeaderMenu from "../ui/HeaderMenu";
import SearchInput from "../ui/SearchInput";
import { getUsers } from "../../api/utils";
import { useNavigate } from "react-router-dom";
import config from "../../core/config";
import "../../styles/Header.css";

const Header = ({ categories, currentUser, onSearch, onMovieSelect }) => {
  const isMobile = useMediaQuery({ query: "(max-width: 860px)" });
  const isTablet = useMediaQuery({
    query: "(min-width: 860px) and (max-width: 1650px)",
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [allUsers, setAllUsers] = useState([]);
  const navigate = useNavigate();

  const sortedUsers = useMemo(() => {
    if (!currentUser) return allUsers;
    const rest = allUsers.filter((u) => u.id !== currentUser.id);
    return [currentUser, ...rest];
  }, [allUsers, currentUser]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getUsers();
        setAllUsers(data);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    // Clean up
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);
  const handleUserSwitch = (user) => {
    localStorage.setItem("current_user", JSON.stringify(user));
    window.location.reload(); // перезагрузка
  };

  const handleLogout = () => {
    localStorage.removeItem("current_user");
    navigate("/login");
    window.location.reload();
  };
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isDropdownOpen]);

  const renderUserAvatar = () => (
    <div
      onClick={() => setIsDropdownOpen((v) => !v)}
      className="header-user__container"
      style={{ position: "relative" }}
    >
      <div className="header-user__avatar-container">
        <img
          src={`${config.backend_url}${currentUser.avatar_url}`}
          alt="user-avatar"
          className="header-user__avatar"
        />
      </div>
      <span>{currentUser.name}</span>

      {/* backdrop для точного закриття (особливо на мобільному) */}
      {isDropdownOpen && (
        <div
          className="userdd__backdrop"
          onClick={(e) => {
            e.stopPropagation();
            setIsDropdownOpen(false);
          }}
        />
      )}

      {isDropdownOpen && (
        <div
          className={
            "header-user__dropdown userdd " + (isMobile ? "userdd--sheet" : "")
          }
          ref={dropdownRef}
          role="menu"
          aria-label="Account menu"
          onClick={(e) => e.stopPropagation()}
        >
          {/* стрілочка для десктопа */}
          {!isMobile && <span className="userdd__arrow" aria-hidden="true" />}

          {/* хедер */}
          <div className="userdd__header">
            <img
              src={`${config.backend_url}${currentUser.avatar_url}`}
              alt=""
              className="userdd__header-avatar"
            />
            <div className="userdd__header-meta">
              <div className="userdd__name">{currentUser.name}</div>

              <div className="userdd__actions">
                <div className="userdd__badge">Активний профіль</div>
                <div className="userdd__action--buttons">
                  <button
                    className="userdd__btn"
                    onClick={() => {
                      navigate("/settings");
                      setIsDropdownOpen(false);
                    }}
                  >
                    <SettingsIcon />
                  </button>
                  <button
                    className="userdd__btn userdd__btn--danger"
                    onClick={handleLogout}
                  >
                    <ExitIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* інші користувачі */}
          {sortedUsers.filter((u) => u.id !== currentUser.id).length > 0 && (
            <>
              <div className="userdd__section-title">Перемкнутися на</div>
              <div className="userdd__list">
                {sortedUsers
                  .filter((u) => u.id !== currentUser.id)
                  .map((user) => (
                    <button
                      key={user.id}
                      className="userdd__item"
                      onClick={() => handleUserSwitch(user)}
                    >
                      <img
                        src={`${config.backend_url}${user.avatar_url}`}
                        alt=""
                        className="userdd__item-avatar"
                      />
                      <span className="userdd__item-name">{user.name}</span>
                    </button>
                  ))}
              </div>
            </>
          )}

          {/* дія: налаштування / вихід */}

          {/* хендл для bottom-sheet */}
          {isMobile && <div className="userdd__handle" aria-hidden="true" />}
        </div>
      )}
    </div>
  );

  return (
    <header
      className={
        isMobile
          ? "header-mobile"
          : isTablet
          ? "header-tablet"
          : "header-desktop"
      }
    >
      {isMobile ? (
        <div className="header-container">
          <div className="header-top-row">
            <a href="/">
              <Logo className="header-logo" />
            </a>
            {renderUserAvatar()}
          </div>
          <SearchInput onSearch={onSearch} onMovieSelect={onMovieSelect} />
          <HeaderMenu categories={categories} />
        </div>
      ) : isTablet ? (
        <div className="header-container tablet-layout">
          <div className="header-top-row">
            <a href="/">
              <Logo className="header-logo" />
            </a>
            <SearchInput onSearch={onSearch} onMovieSelect={onMovieSelect} />
            {renderUserAvatar()}
          </div>
          <HeaderMenu categories={categories} />
        </div>
      ) : (
        <>
          <a className="header-logo-wrapper" href="/">
            <Logo className="header-logo" />
          </a>
          <SearchInput onSearch={onSearch} onMovieSelect={onMovieSelect} />
          <HeaderMenu categories={categories} />
          {renderUserAvatar()}
        </>
      )}
    </header>
  );
};

export default Header;
