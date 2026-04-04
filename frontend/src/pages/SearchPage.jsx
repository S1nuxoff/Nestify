import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { searchTmdb, tmdbImg } from "../api/tmdb";

import Header from "../components/layout/Header";
import MediaCard from "../components/ui/MediaCard";
import Explorer from "../components/layout/Explorer";

import "../styles/SearchPage.css";

function normalizeTmdb(item) {
  const mediaType = item.media_type || "movie";
  return {
    id: item.id,
    tmdbId: item.id,
    mediaType,
    title: item.title || item.name,
    filmName: item.title || item.name,
    image: tmdbImg(item.poster_path, "w342"),
    filmImage: tmdbImg(item.poster_path, "w342"),
    filmDecribe: (item.release_date || item.first_air_date || "").slice(0, 4),
    type: mediaType === "tv" ? "series" : "film",
    _isTmdb: true,
  };
}

function EmptyState({ query, onHome }) {
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
          за запитом <span className="empty-state__query">"{safeQuery}"</span>
        </p>
      )}
      <div className="empty-state__actions">
        <button className="empty-state__btn empty-state__btn--primary" onClick={onHome}>
          На головну
        </button>
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, onSubmit, onClear }) {
  const handleInputKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const first = document.querySelector(".tv-focusable");
      if (first) first.focus({ preventScroll: true });
    }
  };

  return (
    <div className="searchbar">
      <form className="searchbar__form" onSubmit={onSubmit}>
        <input
          className="searchbar__input"
          type="search"
          placeholder="Шукайте фільми, серіали..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          autoFocus
        />
        {value?.trim() ? (
          <button type="button" className="searchbar__btn" onClick={onClear} aria-label="Clear">
            ✕
          </button>
        ) : null}
      </form>
    </div>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("query") || "";
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  let currentUser = null;
  try {
    const raw = localStorage.getItem("current_user");
    currentUser = raw ? JSON.parse(raw) : null;
  } catch {}

  const navigate = useNavigate();

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    (async () => {
      setIsLoading(true);
      setHasSearched(true);
      try {
        const data = await searchTmdb(query);
        setResults(data.map(normalizeTmdb));
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [query]);

  const handleMovieSelect = (movie) => {
    if (movie._isTmdb) {
      navigate(`/title/${movie.mediaType || "movie"}/${movie.tmdbId}`);
    }
  };

  const onClearSearch = () => {
    setParams((prev) => { prev.delete("query"); return prev; }, { replace: true });
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();
    const q = (draft || "").trim();
    if (!q) { onClearSearch(); return; }
    setParams((prev) => { prev.set("query", q); return prev; }, { replace: true });
  };

  const isEmpty = hasSearched && !isLoading && results.length === 0;
  const showDiscover = !query && !hasSearched && !draft?.trim();

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

  return (
    <div className="container">
      <Header currentUser={currentUser || {}} />
      <div className="page-content">
        <SearchBar
          value={draft}
          onChange={setDraft}
          onSubmit={onSearchSubmit}
          onClear={() => { setDraft(""); onClearSearch(); }}
        />
        <div className="category-content">
          {showDiscover ? (
            <div className="empty-state">
              <h2 className="empty-state__title">Почніть з пошуку</h2>
              <p className="empty-state__subtitle">Введіть назву фільму або серіалу ✨</p>
            </div>
          ) : isLoading ? (
            Loading
          ) : isEmpty ? (
            <EmptyState query={query} onHome={() => navigate("/")} />
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
    </div>
  );
}
