// src/pages/HomePage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toRezkaSlug } from "../core/rezkaLink";
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

import { Flame, FolderClock, Group, TrendingUp, Star, Zap, Shuffle, X as XIcon } from "lucide-react";

const PICKER_SEEN_KEY = "nestify_picker_seen";

function PickerPromo({ onGo }) {
  const [visible, setVisible] = React.useState(
    () => !localStorage.getItem(PICKER_SEEN_KEY)
  );

  const dismiss = () => {
    localStorage.setItem(PICKER_SEEN_KEY, "1");
    setVisible(false);
  };

  const go = () => { dismiss(); onGo(); };

  if (!visible) return null;

  return (
    <div className="picker-promo">
      <div className="picker-promo__left">
        <span className="picker-promo__label">Нова функція</span>
        <h3 className="picker-promo__title">Підбір фільмів</h3>
        <p className="picker-promo__sub">Гортай картки та обирай<br/>що дивитись сьогодні</p>
        <button className="picker-promo__cta" onClick={go}>Спробувати →</button>
      </div>
      <div className="picker-promo__cards" aria-hidden="true">
        <div className="picker-promo__card pp-card--c" />
        <div className="picker-promo__card pp-card--b" />
        <div className="picker-promo__card pp-card--a" />
      </div>
      <button className="picker-promo__close" onClick={dismiss} aria-label="Закрити">
        <XIcon size={16} />
      </button>
    </div>
  );
}

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
  const playerConnectionRef = useRef(nestifyPlayerClient.isConnected);

  // читаємо current_user один раз
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
      const wasConnected = playerConnectionRef.current;
      playerConnectionRef.current = isOnline;

      if (isOnline && !wasConnected) {
        setShowPlayerConnected(true);
        setTimeout(() => setShowPlayerConnected(false), 2500);
      }
    };
    nestifyPlayerClient.on("connected", handler);
    return () => nestifyPlayerClient.off("connected", handler);
  }, []);

  const continueWatching = Array.isArray(history)
    ? history.filter(
        (m) =>
          m.position > 30 &&
          m.watch_duration > 0 &&
          m.position / m.watch_duration < 0.95
      )
    : [];

  const handleMovieSelect = (movie) => {
    const rawLink = movie.link || movie.filmLink || movie.navigate_to;
    if (!rawLink) return;

    const slug = toRezkaSlug(rawLink);
    navigate(`/movie/${slug}`);
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
      </div>
      <Featured onMovieSelect={handleMovieSelect} featured={featured} />
      <div className="container">
        <div className="home-page-content">
          {!isPageLoading && (
            <>
              <ContentRowSwiper
                data={page.newest?.items || []}
                // title="Новинки"
                navigate_to="/new"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                navPrefix="/category"
                rows={2}
                // leftIcon={<Flame size={24} className="row-title-icon" />}
              />
              <ContentRowSwiper
                data={page.collections}
                title="Колекції"
                navigate_to="/collections"
                CardComponent={CollectionCard}
                // leftIcon={<Group size={24} className="row-title-icon" />}
              />
              {!isHistoryLoading && continueWatching.length > 0 && (
                <ContentRowSwiper
                  data={continueWatching}
                  title="Продовжити перегляд"
                  navigate_to="/history"
                  CardComponent={MediaCard}
                  cardProps={{
                    type: "continue",
                    onMovieSelect: handleMovieSelect,
                  }}
                />
              )}



              <PickerPromo onGo={() => navigate("/feed")} />

              <ContentRowSwiper
                data={page.popular?.items || []}
                title="Популярне"
                navigate_to="/?filter=popular"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                navPrefix="/category"
                rows={2}
                // leftIcon={<TrendingUp size={32} className="row-title-icon" />}
              />
              <ContentRowSwiper
                data={page.watching?.items || []}
                title="Зараз дивляться"
                navigate_to="/?filter=watching"
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
                navPrefix="/category"
                rows={2}
                // leftIcon={<Zap size={24} className="row-title-icon" />}
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
