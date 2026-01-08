// src/components/layout/Header.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { useNavigate } from "react-router-dom";

import { ReactComponent as Logo } from "../../assets/icons/logo.svg";

import HeaderMenu from "../ui/HeaderMenu";
import SearchButton from "../ui/SearchButton";
import UserAvatarMenu from "../ui/UserAvatarMenu";

import { getUsers } from "../../api/utils";
import config from "../../core/config";

import "../../styles/Header.css"; // твои общие стили
import "../../styles/UserAvatarMenu.css"; // добавь новый файл

const SCROLL_SHADE_THRESHOLD = 20;
const TOP_THRESHOLD = 80;

export default function Header({
  categories,
  currentUser,
  onSearch,
  onMovieSelect,
  showMenu = true,
}) {
  const isMobile = useMediaQuery({ query: "(max-width: 860px)" });

  const [allUsers, setAllUsers] = useState([]);
  const [hideMobileMenu, setHideMobileMenu] = useState(false);

  const navigate = useNavigate();

  const currentAvatar = currentUser?.avatar_url
    ? `${config.backend_url}${currentUser.avatar_url}`
    : "";

  const sortedUsers = useMemo(() => {
    if (!Array.isArray(allUsers) || allUsers.length === 0) return [];
    if (!currentUser) return allUsers;
    const rest = allUsers.filter((u) => u?.id !== currentUser?.id);
    return [currentUser, ...rest];
  }, [allUsers, currentUser]);

  // load users once
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await getUsers();
        if (!mounted) return;
        setAllUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleUserSwitch = (user) => {
    if (!user?.id) return;
    localStorage.setItem("current_user", JSON.stringify(user));
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem("current_user");
    navigate("/login");
    window.location.reload();
  };

  // body class header-scrolled
  useEffect(() => {
    const update = () => {
      const scrolled = (window.scrollY || 0) > SCROLL_SHADE_THRESHOLD;
      document.body.classList.toggle("header-scrolled", scrolled);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // mobile menu hide logic
  useEffect(() => {
    if (!isMobile) {
      setHideMobileMenu(false);
      return;
    }

    let lastY = window.scrollY || 0;
    let ticking = false;

    const update = () => {
      const y = window.scrollY || 0;
      const goingDown = y > lastY;
      const nearTop = y <= TOP_THRESHOLD;

      if (nearTop) setHideMobileMenu(false);
      else if (goingDown) setHideMobileMenu(true);

      lastY = y;
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  return (
    <header className="header-desktop">
      {isMobile ? (
        <div className="mobile-header-container tablet-layout">
          <div className="header-top-row">
            <a href="/" aria-label="Home">
              <Logo className="header-logo" />
            </a>

            <div className="header-right">
              <SearchButton onSearch={onSearch} onMovieSelect={onMovieSelect} />

              <UserAvatarMenu
                isMobile={isMobile}
                currentUser={currentUser}
                currentAvatar={currentAvatar}
                users={sortedUsers}
                backendUrl={config.backend_url}
                onSwitchUser={handleUserSwitch}
                onLogout={handleLogout}
                onOpenSettings={() => navigate("/settings")}
              />
            </div>
          </div>

          {showMenu && (
            <div
              className={`mobile-header-menu ${
                hideMobileMenu ? "is-hidden" : "is-visible"
              }`}
            >
              <HeaderMenu categories={categories} />
            </div>
          )}
        </div>
      ) : (
        <div className="desktop-header-container">
          <a className="header-logo-wrapper" href="/" aria-label="Home">
            <Logo className="header-logo" />
          </a>

          {showMenu && <HeaderMenu categories={categories} />}

          <div className="header-right">
            <SearchButton onSearch={onSearch} onMovieSelect={onMovieSelect} />

            <UserAvatarMenu
              isMobile={isMobile}
              currentUser={currentUser}
              currentAvatar={currentAvatar}
              users={sortedUsers}
              backendUrl={config.backend_url}
              onSwitchUser={handleUserSwitch}
              onLogout={handleLogout}
              onOpenSettings={() => navigate("/settings")}
            />
          </div>
        </div>
      )}
    </header>
  );
}
