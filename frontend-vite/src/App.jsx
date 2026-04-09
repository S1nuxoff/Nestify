// App.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera } from "lucide-react";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import CategoryPage from "./pages/CategoryPage";
import HistoryPage from "./pages/HistoryPage";
import LikedPage from "./pages/LikedPage";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import AuthLoginPage from "./pages/AuthLoginPage";
import AuthRegisterPage from "./pages/AuthRegisterPage";
import PlayerPage from "./pages/PlayerPage";
import CreateUserPage from "./pages/CreateUserPage";
import ManageProfilesPage from "./pages/ManageProfilesPage";
import EditProfilePage from "./pages/EditProfilePage";
import CollectionsPage from "./pages/CollectionsPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import MoviePage from "./pages/MoviePage";
import TmdbMoviePage from "./pages/TmdbMoviePage";
import TmdbCategoryPage from "./pages/TmdbCategoryPage";
import TmdbPersonPage from "./pages/TmdbPersonPage";
import MiniPlayer from "./components/ui/MiniPlayer";
import MobileBottomNav from "./components/layout/MobileBottomNav";
import nestifyPlayerClient from "./api/ws/nestifyPlayerClient";
import config from "./core/config";
import PrivateRoute from "./components/PrivateRoute";
import AccountRoute from "./components/AccountRoute";
import SessionControls from "./components/SessionControls";
import ConnectPlayerPage from "./pages/ConnectPlayerPage";
import BrowseCategory from "./pages/BrowseCategory";
import BrowsePage from "./pages/BrowsePage";
import PickerPage from "./pages/PickerPage";
import TikTokPickerPage from "./pages/TikTokPickerPage";
import AdminPage from "./pages/AdminPage";
import AccountPrefsPage from "./pages/AccountPrefsPage";
import "./styles/App.css";
import "./styles/tv.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { useTVKeyboard } from "./hooks/useTVKeyboard";
import {
  getCurrentProfile,
  hasAccountSession,
  hasSelectedProfile,
} from "./core/session";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const PageTransition = ({ children }) => {
  return (
    <motion.div
      className="route-page-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

const SheetTransition = ({ children }) => {
  return (
    <motion.div
      className="route-page-wrapper route-sheet-wrapper"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
};

function App() {
  const location = useLocation();
  const currentUser = getCurrentProfile();

  // Activate D-pad / TV remote spatial navigation
  useTVKeyboard();

  // Detect TV remote usage: hide cursor and add tv-mode class
  useEffect(() => {
    let tvModeTimer = null;

    const onKeyDown = (e) => {
      const tvKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];
      if (tvKeys.includes(e.key)) {
        document.body.classList.add('tv-mode');
      }
    };
    const onMouseMove = () => {
      clearTimeout(tvModeTimer);
      document.body.classList.remove('tv-mode');
      // Restore tv-mode if no mouse movement for 3s
      tvModeTimer = setTimeout(() => {
        document.body.classList.add('tv-mode');
      }, 3000);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousemove', onMouseMove);
      clearTimeout(tvModeTimer);
    };
  }, []);

  useEffect(() => {
    // піднімаємо WS до TV-плеєра, якщо вже є збережений deviceId
    try {
      const savedDeviceId = window.localStorage.getItem(
        "nestify_player_device_id"
      );
      if (savedDeviceId && savedDeviceId.trim()) {
        console.log(
          "[App] found saved nestify_player_device_id:",
          savedDeviceId.trim()
        );
        nestifyPlayerClient.setDeviceId(savedDeviceId.trim());
      } else {
        console.log("[App] no saved nestify_player_device_id yet");
      }
    } catch (e) {
      console.warn("[App] failed to read nestify_player_device_id:", e);
    }
  }, []);

  return (
    <>
      <ScrollToTop />

      {/* Мини-плеер поверх всего (десктоп) */}
      <MiniPlayer />

      {/* Нав бар — скрываем на плеере и админке */}
      {!location.pathname.startsWith("/player/") && !location.pathname.startsWith("/admin") && (
        <MobileBottomNav
          currentAvatar={currentUser?.avatar_url ? `${config.backend_url}${currentUser.avatar_url}` : ""}
        />
      )}

      {/* Отдельный роут для полноэкранного плеера */}
      <Routes>
        <Route
          path="/player/:movieId"
          element={
            <PrivateRoute>
              <PlayerPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={null} />
      </Routes>

      {/* Основное приложение с анимированными переходами */}
      <div style={{ position: "relative", zIndex: 1 }} className="App">
        <AnimatePresence mode="wait">
          <Routes location={location.state?.backgroundLocation || location} key={(location.state?.backgroundLocation || location).key}>
            <Route path="/player/:movieId" element={null} />
            <Route
              path="/"
              element={
                !hasAccountSession() ? (
                  <PageTransition>
                    <LandingPage />
                  </PageTransition>
                ) : !hasSelectedProfile() ? (
                  <Navigate to="/profiles" replace />
                ) : (
                  <PrivateRoute>
                    <PageTransition>
                      <HomePage currentUser={currentUser} />
                    </PageTransition>
                  </PrivateRoute>
                )
              }
            />

            <Route
              path="/movie/*"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <MoviePage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/catalog/:category"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <TmdbCategoryPage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/title/:mediaType/:tmdbId"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <TmdbMoviePage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/person/:personId"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <TmdbPersonPage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/search"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <SearchPage currentUser={currentUser} />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/category/*"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <CategoryPage currentUser={currentUser} />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/collections"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <CollectionsPage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/account"
              element={
                <PageTransition>
                    <AccountSettingsPage />
                </PageTransition>
              }
            />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/account/prefs" element={<AccountPrefsPage />} />
            <Route
              path="/browse/:categoryTitle"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <BrowsePage categories={[]} />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/history"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <HistoryPage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/liked"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <LikedPage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            {/* сторінка підключення до TV-плеєра */}
            <Route
              path="/connect"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <ConnectPlayerPage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/pick"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <PickerPage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            <Route
              path="/feed"
              element={
                <PrivateRoute>
                  <TikTokPickerPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/auth/login"
              element={
                <PageTransition>
                  <AuthLoginPage />
                </PageTransition>
              }
            />

            <Route
              path="/auth/register"
              element={
                <PageTransition>
                  <AuthRegisterPage />
                </PageTransition>
              }
            />

            <Route
              path="/profiles"
              element={
                <AccountRoute>
                  <PageTransition>
                    <LoginPage />
                  </PageTransition>
                </AccountRoute>
              }
            />

            <Route
              path="/profiles/new"
              element={
                <AccountRoute>
                  <PageTransition>
                    <CreateUserPage />
                  </PageTransition>
                </AccountRoute>
              }
            />

            <Route
              path="/account/profiles"
              element={
                <AccountRoute>
                  <PageTransition>
                    <ManageProfilesPage />
                  </PageTransition>
                </AccountRoute>
              }
            />

            <Route
              path="/profiles/:id/edit"
              element={
                <AccountRoute>
                  <PageTransition>
                    <EditProfilePage />
                  </PageTransition>
                </AccountRoute>
              }
            />

            <Route
              path="/login"
              element={<Navigate to={hasAccountSession() ? "/profiles" : "/auth/login"} replace />}
            />

            <Route
              path="/login/create/user"
              element={
                <PageTransition>
                  <Navigate to="/profiles/new" replace />
                </PageTransition>
              }
            />
          </Routes>
        </AnimatePresence>

        {/* Person sheet overlay — rendered on top, background page stays mounted */}
        <AnimatePresence>
          {location.pathname.startsWith("/person/") && (
            <SheetTransition key={location.pathname}>
              <TmdbPersonPage />
            </SheetTransition>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default App;
