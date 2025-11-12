import React, { useState, useEffect, useMemo, useRef } from "react";
import { useMediaQuery } from "react-responsive";
import { ReactComponent as Logo } from "../../assets/icons/logo.svg";
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

  const renderUserAvatar = () => (
    <div className="header-user__container" style={{ position: "relative" }}>
      <div
        className="header-user__avatar-container"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <img
          src={`${config.backend_url}${currentUser.avatar_url}`}
          alt="user-avatar"
          className="header-user__avatar"
        />
      </div>
      <span> {currentUser.name}</span>

      {isDropdownOpen && (
        <div
          className="header-user__dropdown under-avatar"
          ref={dropdownRef} // <-- вот тут!
        >
          <div className="dropdown-users-list">
            {sortedUsers.map((user, idx) => (
              <div
                key={user.id}
                className={
                  "dropdown-user" +
                  (user.id === currentUser.id ? " dropdown-user--active" : "") +
                  (idx === 0 ? " dropdown-user--first" : "")
                }
                onClick={() => handleUserSwitch(user)}
              >
                <div className="dropdown-user-container">
                  <img
                    src={`${config.backend_url}${user.avatar_url}`}
                    alt={user.name}
                    className="dropdown-user-avatar"
                  />
                  <span className="header-dropdown__user-name">
                    {user.name}
                  </span>
                </div>
                {user.id === currentUser.id && (
                  <>
                    {/* <button
                      className="dropdown-button"
                      onClick={() => navigate("/settings")}
                    >
                      Settings
                    </button> */}
                    <button
                      className="dropdown-button logout"
                      onClick={handleLogout}
                    >
                      Exit
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
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
