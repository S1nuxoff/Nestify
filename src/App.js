import React, { useState, useEffect } from "react";

import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import CategoryPage from "./pages/CategoryPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import PlayerPage from "./pages/PlayerPage";
import CreateUserPage from "./pages/CreateUserPage";
import kodiWebSocket from "./api/ws/kodiWebSocket";
import CollectionsPage from "./pages/CollectionsPage";
import PrivateRoute from "./components/PrivateRoute";
import UserSettingsPage from "./pages/UserSettingsPage";
import "./styles/App.css";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

function App() {
  const currentUser = JSON.parse(localStorage.getItem("current_user"));

  useEffect(() => {
    kodiWebSocket.init();
  }, []);

  return (
    <>
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
      <div style={{ position: "relative", zIndex: 1 }} className="App">
        {/* <div className="container"> */}
        <Routes>
          {/* Главная + модалка */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <HomePage currentUser={currentUser} />
              </PrivateRoute>
            }
          />
          <Route
            path="/movie/:movieLink"
            element={
              <PrivateRoute>
                <HomePage currentUser={currentUser} />
              </PrivateRoute>
            }
          />

          {/* Остальные роуты */}
          <Route
            path="/search"
            element={
              <PrivateRoute>
                <SearchPage currentUser={currentUser} />
              </PrivateRoute>
            }
          />
          <Route
            path="/category/*"
            element={
              <PrivateRoute>
                <CategoryPage currentUser={currentUser} />
              </PrivateRoute>
            }
          />
          <Route
            path="/collections"
            element={
              <PrivateRoute>
                <CollectionsPage />
              </PrivateRoute>
            }
          />

          <Route path="/settings" element={<UserSettingsPage />} />

          <Route
            path="/history"
            element={
              <PrivateRoute>
                <HistoryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/player/:movieId"
            element={
              <PrivateRoute>
                <PlayerPage />
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/create/user" element={<CreateUserPage />} />
        </Routes>
      </div>
      {/* </div> */}
    </>
  );
}

export default App;
