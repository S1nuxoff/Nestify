// src/pages/SearchPage.jsx
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { search, getCategories } from "../api/hdrezka";
import Explorer from "../components/layout/Explorer";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../styles/SearchPage.css";
function EmptyState({ query, onClear, onHome }) {
  const safeQuery = useMemo(() => (query || "").trim(), [query]);

  return (
    <div className="empty-state">
      {/* декоративна “лупа” */}
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

export default function SearchPage({ currentUser }) {
  const [params, setParams] = useSearchParams();
  const query = params.get("query") || "";
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();

  const handleMovieSelect = (movie) => {
    const link = movie.link || movie.filmLink || movie.navigate_to;
    if (!link) return;
    navigate(`/movie/${encodeURIComponent(link)}`);
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
        console.error("Error fetching main page data:", error);
      }
    })();
  }, []);

  const onClearSearch = () => {
    setParams(
      (prev) => {
        prev.delete("query");
        return prev;
      },
      { replace: true }
    );
  };

  const onGoHome = () => navigate("/");

  // Лоадер
  // ...всередині SearchPage.jsx
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

  // Порожньо
  const isEmpty =
    hasSearched && !isLoading && (!results || results.length === 0);

  return (
    <>
      <div className="container">
        <Header
          categories={categories}
          onMovieSelect={handleMovieSelect}
          currentUser={currentUser}
        />

        <div className="category-content">
          {isLoading ? (
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
              title={
                query ? `Результати пошуку: ${query}` : "Результати пошуку"
              }
              currentUser={currentUser}
              onMovieSelect={handleMovieSelect}
            />
          )}
        </div>

        <Footer />
      </div>
    </>
  );
}
