// App.jsx
import React, { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera } from "lucide-react";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import CategoryPage from "./pages/CategoryPage";
import HistoryPage from "./pages/HistoryPage";
import LikedPage from "./pages/LikedPage";
import LoginPage from "./pages/LoginPage";
import PlayerPage from "./pages/PlayerPage";
import CreateUserPage from "./pages/CreateUserPage";
import CollectionsPage from "./pages/CollectionsPage";
import UserSettingsPage from "./pages/UserSettingsPage";
import MoviePage from "./pages/MoviePage";
import MiniPlayer from "./components/ui/MiniPlayer";
import nestifyPlayerClient from "./api/ws/nestifyPlayerClient";
import PrivateRoute from "./components/PrivateRoute";
import SessionControls from "./components/SessionControls";
import ConnectPlayerPage from "./pages/ConnectPlayerPage";
import BrowseCategory from "./pages/BrowseCategory";
import BrowsePage from "./pages/BrowsePage";
import PickerPage from "./pages/PickerPage";
import TikTokPickerPage from "./pages/TikTokPickerPage";
import "./styles/App.css";
import "./styles/tv.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { getPage, getCategories, getWatchHistory } from "./api/hdrezka";
import { useTVKeyboard } from "./hooks/useTVKeyboard";

const PageTransition = ({ children }) => {
  return (
    <motion.div
      className="route-page-wrapper"
      initial={{ opacity: 0, marginTop: 8 }}
      animate={{ opacity: 1, marginTop: 0 }}
      exit={{ opacity: 0, marginTop: -8 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
};

function App() {
  const [categories, setCategories] = useState([]);
  const location = useLocation();
  const currentUser = JSON.parse(localStorage.getItem("current_user"));

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
    const fetchData = async () => {
      try {
        const { categories: list = [] } = await getCategories();
        setCategories(list);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchData();
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
      {/* Мини-плеер поверх всего */}
      <MiniPlayer />

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
      </Routes>

      {/* Основное приложение с анимированными переходами */}
      <div style={{ position: "relative", zIndex: 1 }} className="App">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <HomePage currentUser={currentUser} />
                  </PageTransition>
                </PrivateRoute>
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
              path="/settings"
              element={
                <PageTransition>
                  <UserSettingsPage />
                </PageTransition>
              }
            />
            <Route
              path="/browse/:categoryTitle"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <BrowsePage categories={categories} />
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
              path="/login"
              element={
                <PageTransition>
                  <LoginPage />
                </PageTransition>
              }
            />

            <Route
              path="/login/create/user"
              element={
                <PageTransition>
                  <CreateUserPage />
                </PageTransition>
              }
            />
          </Routes>
        </AnimatePresence>
      </div>
    </>
  );
}

export default App;
