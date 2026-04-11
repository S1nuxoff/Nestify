// App.jsx — TV version
import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import CategoryPage from "./pages/CategoryPage";
import HistoryPage from "./pages/HistoryPage";
import LikedPage from "./pages/LikedPage";
import LoginPage from "./pages/LoginPage";
import AuthLoginPage from "./pages/AuthLoginPage";
import AuthRegisterPage from "./pages/AuthRegisterPage";
import PlayerPage from "./pages/PlayerPage";
import CreateUserPage from "./pages/CreateUserPage";
import ManageProfilesPage from "./pages/ManageProfilesPage";
import EditProfilePage from "./pages/EditProfilePage";
import CollectionsPage from "./pages/CollectionsPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import AccountPage from "./pages/AccountPage";
import AccountDevicesPage from "./pages/AccountDevicesPage";
import AccountAboutPage from "./pages/AccountAboutPage";
import AccountPrefsPage from "./pages/AccountPrefsPage";
import MoviePage from "./pages/MoviePage";
import TmdbMoviePage from "./pages/TmdbMoviePage";
import TmdbCategoryPage from "./pages/TmdbCategoryPage";
import TmdbPersonPage from "./pages/TmdbPersonPage";
import TvLoginPage from "./pages/TvLoginPage";
import TvSidebar from "./components/layout/TvSidebar";
import PrivateRoute from "./components/PrivateRoute";
import AccountRoute from "./components/AccountRoute";
import { getAndroidBootstrapState, isAndroidBridge } from "./api/AndroidBridge";
import config from "./core/config";
import nestifyPlayerClient from "./api/ws/nestifyPlayerClient";
import { useTvDevice } from "./hooks/useTvDevice";
import { useSpatialNav } from "./hooks/useSpatialNav";
import "./styles/App.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import {
  clearAuthSession,
  getCurrentProfile,
  hasAccountSession,
  hasSelectedProfile,
  setAuthSession,
  setCurrentProfile,
  setProfilesCache,
} from "./core/session";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const PageTransition = ({ children }) => (
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

function App() {
  const location = useLocation();
  const currentUser = getCurrentProfile();
  const { device: tvDevice } = useTvDevice(5000);
  const [bootstrapReady, setBootstrapReady] = useState(!isAndroidBridge());

  // D-pad spatial navigation
  useSpatialNav();

  // TV mode: always on — focus styles and cursor:none never removed
  useEffect(() => {
    document.body.classList.add("tv-mode");
  }, []);

  useEffect(() => {
    if (!isAndroidBridge()) {
      setBootstrapReady(true);
      return;
    }

    try {
      const bootstrap = getAndroidBootstrapState();
      if (bootstrap?.has_account_session && bootstrap?.auth_token && bootstrap?.account) {
        setAuthSession({
          token: bootstrap.auth_token,
          account: bootstrap.account,
          profile: bootstrap.profile || null,
        });
        setProfilesCache(Array.isArray(bootstrap.profiles) ? bootstrap.profiles : []);
        if (bootstrap.profile) {
          setCurrentProfile(bootstrap.profile);
        }
      } else {
        clearAuthSession();
      }
    } catch (e) {
      console.warn("[App] android bootstrap failed:", e);
      clearAuthSession();
    } finally {
      setBootstrapReady(true);
    }
  }, []);

  useEffect(() => {
    if (isAndroidBridge()) {
      nestifyPlayerClient.disconnect();
      return;
    }

    try {
      const profile = getCurrentProfile();
      nestifyPlayerClient.setProfileName(profile?.name || "");
      nestifyPlayerClient.setAvatarUrl(
        profile?.avatar_url ? `${config.backend_url}${profile.avatar_url}` : ""
      );
      nestifyPlayerClient.setUserId(profile?.id || "");

      if (tvDevice?.device_id && (tvDevice.playing || nestifyPlayerClient.shouldHoldConnection())) {
        nestifyPlayerClient.setDeviceId(tvDevice.device_id);
      } else {
        nestifyPlayerClient.disconnect();
      }
    } catch (e) {
      console.warn("[App] failed to initialize TV device:", e);
    }
  }, [
    tvDevice?.device_id,
    tvDevice?.playing,
    currentUser?.id,
    currentUser?.name,
    currentUser?.avatar_url,
  ]);

  if (!bootstrapReady) {
    return <div className="App" style={{ background: "#000", minHeight: "100vh" }} />;
  }

  return (
    <>
      <TvSidebar />
      <ScrollToTop />

      {/* Full-screen player route — rendered outside AnimatePresence */}
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

      <div style={{ position: "relative", zIndex: 1 }} className="App">
        <AnimatePresence mode="wait">
          <Routes
            location={location.state?.backgroundLocation || location}
            key={(location.state?.backgroundLocation || location).key}
          >
            <Route path="/player/:movieId" element={null} />

            <Route
              path="/"
              element={
                !hasAccountSession() ? (
                  <Navigate to="/auth/login" replace />
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

            <Route
              path="/account"
              element={
                <PageTransition>
                  <AccountSettingsPage />
                </PageTransition>
              }
            />
            <Route path="/account/account" element={<AccountPage />} />
            <Route path="/account/devices" element={<AccountDevicesPage />} />
            <Route path="/account/about" element={<AccountAboutPage />} />
            <Route path="/account/prefs" element={<AccountPrefsPage />} />

            <Route
              path="/tv-login"
              element={
                <PageTransition>
                  <TvLoginPage />
                </PageTransition>
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
              path="/manage-profiles"
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
              element={<Navigate to="/profiles/new" replace />}
            />
          </Routes>
        </AnimatePresence>
      </div>
    </>
  );
}

export default App;
