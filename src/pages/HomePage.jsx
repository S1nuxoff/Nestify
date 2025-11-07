import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getPage,
  search,
  getCategories,
  getMainPage,
  getWatchHistory,
} from "../api/hdrezka";
import { getFeatured } from "../api/utils";

import Featured from "../components/section/Featured";
import SessionPlayer from "../components/section/SessionPlayer";
import MediaModal from "../components/modal/MediaModal";
import useLiveSession from "../hooks/useLiveSession";
import useMovieDetails from "../hooks/useMovieDetails";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ContentRowSwiper from "../components/section/ContentRowSwiper";
import "../styles/HomePage.css";
import CollectionCard from "../components/ui/CollectionCard";
import MediaCard from "../components/ui/MediaCard";
import kodiWebSocket from "../api/ws/kodiWebSocket";
import Alert from "../components/ui/Alert";

function HomePage() {
  const [kodiOnline, setKodiOnline] = useState(kodiWebSocket.isConnected);
  const [showKodiConnected, setShowKodiConnected] = useState(false);
  const [page, setPage] = useState({});
  const [featured, setFeatured] = useState([]);
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Router helpers
  const { movieLink } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Безпечне читання current_user
  let currentUser = null;
  try {
    const raw = localStorage.getItem("current_user");
    currentUser = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("bad current_user in localStorage", e);
    currentUser = null;
  }

  const { movieDetails, loading: movieLoading } = useMovieDetails(
    selectedMovie?.filmLink || selectedMovie?.link
  );

  const session = useLiveSession(currentUser ? Number(currentUser.id) : null);

  // --- Открытие модалки по movieLink из url ---
  useEffect(() => {
    if (movieLink) {
      const link = decodeURIComponent(movieLink);
      let movie = null;
      const searchByLink = (arr) =>
        arr?.find(
          (m) =>
            m.link === link || m.filmLink === link || m.navigate_to === link
        );
      movie = searchByLink(page.newest?.items);
      if (!movie) movie = searchByLink(page.popular_movies?.items);
      if (!movie) movie = searchByLink(page.popular_series?.items);
      if (!movie) movie = searchByLink(featured);
      if (!movie) movie = searchByLink(history);
      if (movie) setSelectedMovie(movie);
      else setSelectedMovie({ link }); // для запроса деталей по link
    } else {
      setSelectedMovie(null);
    }
  }, [movieLink, page, featured, history]);

  // --- Открытие модалки и запись адреса ---
  const handleMovieSelect = (movie) => {
    setSelectedMovie(movie);
    navigate(
      `/movie/${encodeURIComponent(
        movie.link || movie.filmLink || movie.navigate_to
      )}`
    );
  };

  // --- Закрытие модалки ---
  const closePopup = () => {
    setSelectedMovie(null);
    if (location.pathname.startsWith("/movie/")) {
      navigate("/", { replace: true });
    }
  };

  // --- Поиск/загрузка ---
  const handleSearch = async (query) => {
    try {
      if (query.trim() === "") {
        setIsPageLoading(true);
        setPage(await getPage());
      } else {
        setIsPageLoading(true);
        setPage(await search(query));
      }
    } catch (err) {
      console.error("search error:", err);
    } finally {
      setIsPageLoading(false);
    }
  };

  // --- Первичная загрузка данных ---
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
        setCategories((await getCategories()).categories || []);
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

  // --- Событие подключения к Kodi ---
  useEffect(() => {
    const handler = (isOnline) => {
      setKodiOnline(isOnline);
      if (isOnline) {
        setShowKodiConnected(true);
        setTimeout(() => setShowKodiConnected(false), 2500);
      }
    };
    kodiWebSocket.on("connected", handler);
    return () => kodiWebSocket.off("connected", handler);
  }, []);
  console.log(page.collections);
  return (
    <>
      <Alert
        visible={showKodiConnected}
        type="success"
        title="Kodi підключено"
        message="З'єднання з Kodi встановлено успішно!"
      />

      {selectedMovie && (
        <MediaModal
          loading={movieLoading}
          movieDetails={movieDetails}
          currentUser={currentUser}
          movie={selectedMovie}
          onClose={closePopup}
        />
      )}

      <div className="container">
        <Header
          categories={categories}
          currentUser={currentUser}
          onSearch={handleSearch}
          onMovieSelect={handleMovieSelect}
        />

        {session ? (
          <SessionPlayer
            session={session}
            history={history}
            currentUser={currentUser}
            onMovieSelect={handleMovieSelect}
          />
        ) : (
          <Featured onMovieSelect={handleMovieSelect} featured={featured} />
        )}

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
                data={page.collections}
                title="Колекції"
                navigate_to="/collections"
                CardComponent={CollectionCard}
              />

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
