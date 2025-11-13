// App.jsx
import React, { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import CategoryPage from "./pages/CategoryPage";
import HistoryPage from "./pages/HistoryPage";
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

import "./styles/App.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

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
  const location = useLocation();
  const currentUser = JSON.parse(localStorage.getItem("current_user"));

  useEffect(() => {
    // пробуємо підняти збережений deviceId
    try {
      const savedDeviceId = window.localStorage.getItem("current_device_id");
      if (savedDeviceId) {
        nestifyPlayerClient.setDeviceId(savedDeviceId);
      }
    } catch (e) {
      console.warn("[App] failed to read current_device_id:", e);
    }

    nestifyPlayerClient.init();
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
              path="/movie/:movieLink"
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
              path="/history"
              element={
                <PrivateRoute>
                  <PageTransition>
                    <HistoryPage />
                  </PageTransition>
                </PrivateRoute>
              }
            />

            {/* новий роут: підключення до TV-плеєра */}
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
