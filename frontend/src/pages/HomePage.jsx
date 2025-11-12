// src/pages/HomePage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  getPage,
  search,
  getCategories,
  getMainPage,
  getWatchHistory,
} from "../api/hdrezka";
import { getFeatured } from "../api/utils";

import Featured from "../components/section/Featured";
// import SessionPlayer from "../components/section/SessionPlayer"; // якщо треба
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ContentRowSwiper from "../components/section/ContentRowSwiper";
import "../styles/HomePage.css";
import CollectionCard from "../components/ui/CollectionCard";
import MediaCard from "../components/ui/MediaCard";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";
import Alert from "../components/ui/Alert";

function HomePage() {
  const [showPlayerConnected, setShowPlayerConnected] = useState(false);
  const [page, setPage] = useState({});
  const [featured, setFeatured] = useState([]);
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();

  // читаємо current_user ОДИН раз
  useEffect(() => {
    try {
      const raw = localStorage.getItem("current_user");
      setCurrentUser(raw ? JSON.parse(raw) : null);
    } catch (e) {
      console.error("bad current_user in localStorage", e);
      setCurrentUser(null);
    }
  }, []);

  const handleSearch = async (query) => {
    try {
      setIsPageLoading(true);
      if (query.trim() === "") {
        setPage(await getPage());
      } else {
        setPage(await search(query));
      }
    } catch (err) {
      console.error("search error:", err);
    } finally {
      setIsPageLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setPage(await getMainPage());
      } catch (e) {
        console.error("getMainPage error:", e);
      } finally {
        setIsPageLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getCategories();
        setCategories(res.categories || []);
      } catch (e) {
        console.error("getCategories error:", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setFeatured(await getFeatured());
      } catch (e) {
        console.error("getFeatured error:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentUser?.id) {
      setIsHistoryLoading(false);
      return;
    }

    (async () => {
      try {
        setHistory(await getWatchHistory(currentUser.id));
      } catch (e) {
        console.error("getWatchHistory error:", e);
      } finally {
        setIsHistoryLoading(false);
      }
    })();
  }, [currentUser?.id]);

  // нотиф про підключення плеєра
  useEffect(() => {
    const handler = (isOnline) => {
      if (isOnline) {
        setShowPlayerConnected(true);
        setTimeout(() => setShowPlayerConnected(false), 2500);
      }
    };
    nestifyPlayerClient.on("connected", handler);
    return () => nestifyPlayerClient.off("connected", handler);
  }, []);

  const handleMovieSelect = (movie) => {
    const link = movie.link || movie.filmLink || movie.navigate_to;
    if (!link) return;
    navigate(`/movie/${encodeURIComponent(link)}`);
  };

  return (
    <>
      <Alert
        visible={showPlayerConnected}
        type="success"
        title="Nestify Player підключено"
        message="З'єднання з плеєром встановлено успішно!"
      />

      <div className="container">
        <Header
          categories={categories}
          currentUser={currentUser || {}}
          onSearch={handleSearch}
          onMovieSelect={handleMovieSelect}
        />

        <Featured onMovieSelect={handleMovieSelect} featured={featured} />

        <div className="home-page-content">
          {!isHistoryLoading &&
            Array.isArray(history) &&
            history.length > 0 && (
              <ContentRowSwiper
                data={history}
                title="Історія перегляду"
                navigate_to="/history"
                CardComponent={MediaCard}
                cardProps={{
                  type: "history",
                  onMovieSelect: handleMovieSelect,
                }}
              />
            )}

          {!isPageLoading && (
            <>
              <ContentRowSwiper
                data={page.newest?.items || []}
                title="Новинки"
                navigate_to="/new"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                navPrefix="/category"
                rows={2}
              />

              <ContentRowSwiper
                data={page.collections}
                title="Колекції"
                navigate_to="/collections"
                CardComponent={CollectionCard}
              />

              <ContentRowSwiper
                data={page.popular?.items || []}
                title="Популярне"
                navigate_to="/?filter=popular"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                navPrefix="/category"
                rows={2}
              />

              <ContentRowSwiper
                data={page.watching?.items || []}
                title="Зараз дивляться"
                navigate_to="/?filter=watching"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                navPrefix="/category"
                rows={2}
              />
            </>
          )}

          {isPageLoading && (
            <div className="spinner-wrapper">
              <div className="spinner"></div>
            </div>
          )}

          <Footer />
        </div>
      </div>
    </>
  );
}

export default HomePage;
