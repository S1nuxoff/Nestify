// src/pages/SearchPage.jsx
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { search, getCategories, getWatchHistory } from "../api/hdrezka";

import Explorer from "../components/layout/Explorer";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ContentRowSwiper from "../components/section/ContentRowSwiper";
import MediaCard from "../components/ui/MediaCard";

import { toRezkaSlug } from "../core/rezkaLink";

import "../styles/SearchPage.css";

function EmptyState({ query, onClear, onHome }) {
  const safeQuery = useMemo(() => (query || "").trim(), [query]);

  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="empty-state__svg">
          <path d="M10 2a8 8 0 105.293 14.293l4.707 4.707 1.414-1.414-4.707-4.707A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z" />
        </svg>
      </div>

      <h2 className="empty-state__title">Нічого не знайдено</h2>
      {safeQuery && (
        <p className="empty-state__subtitle">
          за запитом <span className="empty-state__query">“{safeQuery}”</span>
        </p>
      )}

      <div className="empty-state__actions">
        <button
          className="empty-state__btn empty-state__btn--primary"
          onClick={onHome}
        >
          На головну
        </button>
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, onSubmit, onClear }) {
  return (
    <div className="searchbar">
      <form className="searchbar__form" onSubmit={onSubmit}>
        <input
          className="searchbar__input"
          type="search"
          placeholder="Шукайте фільми, серіали..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />

        {value?.trim() ? (
          <button
            type="button"
            className="searchbar__btn"
            onClick={onClear}
            aria-label="Clear"
          >
            ✕
          </button>
        ) : null}
      </form>
    </div>
  );
}

export default function SearchPage({ currentUser: currentUserProp }) {
  const [params, setParams] = useSearchParams();
  const query = params.get("query") || "";

  const [draft, setDraft] = useState(query);

  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 👇 для “Дивитися далі”
  const [currentUser, setCurrentUser] = useState(currentUserProp || null);
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const navigate = useNavigate();

  // якщо проп currentUser не передали — беремо з localStorage, як у HomePage
  useEffect(() => {
    if (currentUserProp) {
      setCurrentUser(currentUserProp);
      return;
    }
    try {
      const raw = localStorage.getItem("current_user");
      setCurrentUser(raw ? JSON.parse(raw) : null);
    } catch (e) {
      console.error("bad current_user in localStorage", e);
      setCurrentUser(null);
    }
  }, [currentUserProp]);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  const handleMovieSelect = (movie) => {
    const rawLink = movie.link || movie.filmLink || movie.navigate_to;
    if (!rawLink) return;

    const slug = toRezkaSlug(rawLink);
    navigate(`/movie/${slug}`);
  };

  // пошук по query
  useEffect(() => {
    if (!query) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    (async () => {
      try {
        setIsLoading(true);
        setHasSearched(true);
        const data = await search(query);
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("search error:", err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [query]);

  // категорії для хедера
  useEffect(() => {
    (async () => {
      try {
        const { categories: list = [] } = await getCategories();
        setCategories(list);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    })();
  }, []);

  // ✅ історія перегляду для “Дивитися далі”
  useEffect(() => {
    if (!currentUser?.id) {
      setHistory([]);
      setIsHistoryLoading(false);
      return;
    }

    (async () => {
      try {
        setIsHistoryLoading(true);
        const res = await getWatchHistory(currentUser.id);
        setHistory(Array.isArray(res) ? res : []);
      } catch (e) {
        console.error("getWatchHistory error:", e);
        setHistory([]);
      } finally {
        setIsHistoryLoading(false);
      }
    })();
  }, [currentUser?.id]);

  const onClearSearch = () => {
    setParams(
      (prev) => {
        prev.delete("query");
        return prev;
      },
      { replace: true }
    );
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();
    const q = (draft || "").trim();

    if (!q) {
      onClearSearch();
      return;
    }

    setParams(
      (prev) => {
        prev.set("query", q);
        return prev;
      },
      { replace: true }
    );
  };

  const onGoHome = () => navigate("/");

  const Loading = (
    <div className="skel-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div className="sk-card" key={i}>
          <div className="sk-poster" />
          <div className="sk-meta">
            <div className="sk-type sk-shimmer" />
            <div className="sk-title sk-shimmer" />
            <div className="sk-sub sk-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );

  const isEmpty =
    hasSearched && !isLoading && (!results || results.length === 0);

  // ✅ стан “ще не шукали”
  const showDiscover = !query && !hasSearched && !isLoading && !draft?.trim();

  return (
    <>
      <div className="container">
        <Header
          categories={categories}
          onMovieSelect={handleMovieSelect}
          currentUser={currentUser || {}}
        />

        <div className="page-content">
          <SearchBar
            value={draft}
            onChange={setDraft}
            onSubmit={onSearchSubmit}
            onClear={() => {
              setDraft("");
              onClearSearch();
            }}
          />

          <div className="category-content">
            {showDiscover ? (
              <div className="search-discover">
                {!isHistoryLoading &&
                  Array.isArray(history) &&
                  history.length > 0 && (
                    <ContentRowSwiper
                      data={history}
                      title="Дивитися далі"
                      navigate_to="/history"
                      CardComponent={MediaCard}
                      cardProps={{
                        type: "history",
                        onMovieSelect: handleMovieSelect,
                      }}
                      rows={2}
                    />
                  )}

                {!isHistoryLoading && (!history || history.length === 0) && (
                  <div className="empty-state">
                    <h2 className="empty-state__title">Почніть з пошуку</h2>
                    <p className="empty-state__subtitle">
                      Введіть назву фільму або серіалу зверху ✨
                    </p>
                  </div>
                )}
              </div>
            ) : isLoading ? (
              Loading
            ) : isEmpty ? (
              <EmptyState
                query={query}
                onClear={onClearSearch}
                onHome={onGoHome}
              />
            ) : (
              <Explorer
                Page={results}
                title={query}
                currentUser={currentUser}
                onMovieSelect={handleMovieSelect}
              />
            )}
          </div>
        </div>

        {/* <Footer /> */}
      </div>
    </>
  );
}
