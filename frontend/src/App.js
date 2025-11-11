import React, { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
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
import "./styles/App.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
function App() {
  const currentUser = JSON.parse(localStorage.getItem("current_user"));
  useEffect(() => {
    nestifyPlayerClient.init();
  }, []);
  return (
    <>
      {" "}
      <MiniPlayer /> {/* Full-screen player */}{" "}
      <Routes>
        {" "}
        <Route
          path="/player/:movieId"
          element={
            <PrivateRoute>
              {" "}
              <PlayerPage />{" "}
            </PrivateRoute>
          }
        />{" "}
      </Routes>{" "}
      <div style={{ position: "relative", zIndex: 1 }} className="App">
        {" "}
        <Routes>
          {" "}
          <Route
            path="/"
            element={
              <PrivateRoute>
                {" "}
                <HomePage currentUser={currentUser} />{" "}
              </PrivateRoute>
            }
          />{" "}
          <Route
            path="/movie/:movieLink"
            element={
              <PrivateRoute>
                {" "}
                <MoviePage />{" "}
              </PrivateRoute>
            }
          />{" "}
          <Route
            path="/search"
            element={
              <PrivateRoute>
                {" "}
                <SearchPage currentUser={currentUser} />{" "}
              </PrivateRoute>
            }
          />{" "}
          <Route
            path="/category/*"
            element={
              <PrivateRoute>
                {" "}
                <CategoryPage currentUser={currentUser} />{" "}
              </PrivateRoute>
            }
          />{" "}
          <Route
            path="/collections"
            element={
              <PrivateRoute>
                {" "}
                <CollectionsPage />{" "}
              </PrivateRoute>
            }
          />{" "}
          <Route path="/settings" element={<UserSettingsPage />} />{" "}
          <Route
            path="/history"
            element={
              <PrivateRoute>
                {" "}
                <HistoryPage />{" "}
              </PrivateRoute>
            }
          />{" "}
          <Route path="/login" element={<LoginPage />} />{" "}
          <Route path="/login/create/user" element={<CreateUserPage />} />{" "}
        </Routes>{" "}
      </div>{" "}
    </>
  );
}
export default App;
