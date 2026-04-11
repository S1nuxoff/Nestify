import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { Search, SlidersHorizontal, X, ChevronRight, Mic } from "lucide-react";
import { searchTmdbMulti, discover, getTrending, normalizeTmdbItem, tmdbImg, getMovieDetails, getTvDetails } from "../api/tmdb";
import { getWatchHistory } from "../api/v3";
import MediaCard from "../components/ui/MediaCard";
import ContentRow from "../components/section/ContentRow";
import FilterPanel, { GENRES, COUNTRIES } from "../components/ui/FilterPanel";
import TvKeyboard from "../components/ui/TvKeyboard";
import Header from "../components/layout/Header";
import { recordFocus } from "../utils/spatialNav";
import "../styles/SearchPage.css";

function normalizeTmdb(item) {
  return normalizeTmdbItem({ ...item, media_type: item.media_type || "movie" });
}

// Genre tiles — movieId is a well-known TMDB movie whose backdrop represents the genre
const GENRE_TILES = [
  { id: "28",    name: "Бойовик",    movieId: 76341  },
  { id: "18",    name: "Драма",      movieId: 278    },
  { id: "35",    name: "Комедія",    movieId: 120467 },
  { id: "53",    name: "Трилер",     movieId: 27205  },
  { id: "27",    name: "Жахи",       movieId: 419430 },
  { id: "878",   name: "Фантастика", movieId: 438631 },
  { id: "12",    name: "Пригоди",    movieId: 329    },
  { id: "16",    name: "Анімація",   movieId: 129    },
  { id: "10749", name: "Мелодрама",  movieId: 313369 },
  { id: "80",    name: "Кримінал",   movieId: 238    },
];

const BACK_CODES  = new Set([8, 27, 461, 10009, 88]);
const ENTER_CODES = new Set([13, 29443, 65385, 117]);

const hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const query = params.get("query") || "";
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState({ movies: [], tv: [], persons: [] });
  const [discoverItems, setDiscoverItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [listening, setListening]   = useState(false);
  const [activeFilters, setActiveFilters] = useState(() => {
    const stateGenres = location.state?.genres || [];
    return {
      mediaType: "all", genres: stateGenres, countries: [], yearMin: null, yearMax: null,
      ratingMin: 0, ratingMax: 10, sortBy: "popularity.desc",
    };
  });

  const [recentItems, setRecentItems]   = useState([]);
  const [genreImages, setGenreImages]   = useState({});
  const [topSearches, setTopSearches]   = useState([]);

  const searchBtnRef  = useRef(null);
  const filterBtnRef  = useRef(null);
  const recognitionRef = useRef(null);

  let currentUser = null;
  try { const raw = localStorage.getItem("current_user"); currentUser = raw ? JSON.parse(raw) : null; } catch {}

  function hasActiveFilters() {
    return activeFilters.genres.length > 0 || activeFilters.countries.length > 0 ||
      activeFilters.yearMin || activeFilters.yearMax ||
      activeFilters.ratingMin > 0 || activeFilters.ratingMax < 10 ||
      activeFilters.mediaType !== "all";
  }

  const isDefaultState = !query && !hasActiveFilters();
  const activeFiltersOn = hasActiveFilters();

  // ── Discovery data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDefaultState) return;

    if (currentUser?.id) {
      getWatchHistory(currentUser.id).then(async (raw) => {
        const unique = [], seen = new Set();
        for (const item of raw) {
          if (!seen.has(item.movie_id) && item.movie_id?.startsWith("tmdb_")) {
            seen.add(item.movie_id);
            const match = item.movie_id.match(/^tmdb_(movie|tv)_(\d+)$/);
            if (match) unique.push({ tmdbId: match[2], mediaType: match[1], historyName: item.film_name || "" });
          }
        }
        const slice = unique.slice(0, 10);
        const enriched = await Promise.all(
          slice.map(async ({ tmdbId, mediaType, historyName }) => {
            try {
              const details = mediaType === "tv" ? await getTvDetails(tmdbId) : await getMovieDetails(tmdbId);
              return normalizeTmdbItem({ ...details, media_type: mediaType });
            } catch {
              return { tmdbId, mediaType, filmName: historyName, filmImage: tmdbImg(null), image: null, filmDecribe: "", _isTmdb: true };
            }
          })
        );
        setRecentItems(enriched);
      }).catch(() => {});
    }

    Promise.all(
      GENRE_TILES.map((g) =>
        getMovieDetails(g.movieId)
          .then((r) => ({ id: g.id, img: r.backdrop_path ? tmdbImg(r.backdrop_path, "w780") : null }))
          .catch(() => ({ id: g.id, img: null }))
      )
    ).then((res) => {
      const map = {};
      res.forEach(({ id, img }) => { map[id] = img; });
      setGenreImages(map);
    });

    getTrending("week").then((items) => {
      setTopSearches(items.slice(0, 10).map(normalizeTmdb));
    }).catch(() => {});
  }, [isDefaultState]);

  // ── Filtered discover ───────────────────────────────────────────────────
  useEffect(() => {
    if (isDefaultState || query) return;
    (async () => {
      setIsLoading(true);
      try {
        const { mediaType, genres, countries, yearMin, yearMax, ratingMin, ratingMax, sortBy } = activeFilters;
        const p = {
          sort_by: sortBy,
          ...(genres.length ? { with_genres: genres.join(",") } : {}),
          ...(countries.length ? { with_origin_country: countries.join("|") } : {}),
          ...(yearMin ? { "primary_release_date.gte": `${yearMin}-01-01` } : {}),
          ...(yearMax ? { "primary_release_date.lte": `${yearMax}-12-31` } : {}),
          ...(ratingMin > 0 ? { "vote_average.gte": ratingMin } : {}),
          ...(ratingMax < 10 ? { "vote_average.lte": ratingMax } : {}),
          "vote_count.gte": 50,
        };
        const fetches = (mediaType === "all" ? ["movie", "tv"] : mediaType === "animation" ? ["movie", "tv"] : [mediaType]).map((t) =>
          discover(t, mediaType === "animation" ? { ...p, with_genres: [...genres, "16"].join(",") } : p)
            .then((r) => r.results.map((i) => normalizeTmdbItem({ ...i, media_type: t })))
            .catch(() => [])
        );
        const arrays = await Promise.all(fetches);
        setDiscoverItems(arrays.flat().sort(() => Math.random() - 0.5).slice(0, 40));
      } finally { setIsLoading(false); }
    })();
  }, [activeFilters, query, isDefaultState]);

  // ── Search ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!query) { setResults({ movies: [], tv: [], persons: [] }); return; }
    (async () => {
      setIsLoading(true);
      try {
        const data = await searchTmdbMulti(query);
        setResults({
          movies:  data.filter((r) => r.media_type === "movie").map(normalizeTmdb),
          tv:      data.filter((r) => r.media_type === "tv").map(normalizeTmdb),
          persons: data.filter((r) => r.media_type === "person").slice(0, 5),
        });
      } catch {
        setResults({ movies: [], tv: [], persons: [] });
      } finally { setIsLoading(false); }
    })();
  }, [query]);

  useEffect(() => { setDraft(query); }, [query]);

  // ── Submit query ────────────────────────────────────────────────────────
  const submitQuery = useCallback((q) => {
    const trimmed = q.trim();
    if (!trimmed) { setParams((p) => { p.delete("query"); return p; }, { replace: true }); return; }
    setParams((p) => { p.set("query", trimmed); return p; }, { replace: true });
  }, [setParams]);

  // ── Keyboard close handler ──────────────────────────────────────────────
  const handleKeyboardClose = useCallback((value) => {
    setShowKeyboard(false);
    setDraft(value);
    submitQuery(value);
    // Restore focus to search button
    requestAnimationFrame(() => {
      searchBtnRef.current?.focus({ preventScroll: true });
      if (searchBtnRef.current) recordFocus(searchBtnRef.current);
    });
  }, [submitQuery]);

  // ── Voice search ────────────────────────────────────────────────────────
  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }

    const rec = new SR();
    rec.lang = "uk-UA";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = () => setListening(false);
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript || "";
      if (text) { setDraft(text); submitQuery(text); }
    };
    recognitionRef.current = rec;
    rec.start();
  }, [submitQuery]);

  // ── Keyboard handler for search/mic buttons ─────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (showKeyboard || showFilterPanel) return; // other modals handle their own keys
      const code = e.keyCode || e.which;
      const active = document.activeElement;

      if (ENTER_CODES.has(code) && active === searchBtnRef.current) {
        e.preventDefault();
        setShowKeyboard(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showKeyboard, showFilterPanel]);

  const handleMovieSelect = (movie) => navigate(`/title/${movie.mediaType || "movie"}/${movie.tmdbId}`);
  const handleApplyFilters = (filters) => { setActiveFilters(filters); setShowFilterPanel(false); };

  const hasQueryResults = results.movies.length > 0 || results.tv.length > 0 || results.persons.length > 0;

  return (
    <div className="sp-root">
      <Header currentUser={currentUser || {}} />

      <h1 className="sp-heading">Каталог</h1>

      {/* ── Sticky search bar ──────────────────────────────────────────── */}
      <div className="sp-sticky">
        <div className="sp-searchbar">
          {/* Search field — opens virtual keyboard on Enter */}
          <button
            ref={searchBtnRef}
            className="sp-searchbar__field"
            onClick={() => setShowKeyboard(true)}
            tabIndex={0}
          >
            <Search size={18} className="sp-searchbar__icon" />
            <span className={`sp-searchbar__text${!draft ? " sp-searchbar__text--placeholder" : ""}`}>
              {draft || "Пошук фільмів, серіалів…"}
            </span>
            {draft && (
              <span
                className="sp-searchbar__clear"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft("");
                  setParams((p) => { p.delete("query"); return p; }, { replace: true });
                }}
              >
                <X size={14} />
              </span>
            )}
          </button>

          {/* Voice search */}
          {hasSpeech && (
            <button
              className={`sp-icon-btn${listening ? " sp-icon-btn--active" : ""}`}
              onClick={startVoice}
              aria-label="Голосовий пошук"
              tabIndex={0}
            >
              <Mic size={18} />
            </button>
          )}

          {/* Filter */}
          <button
            ref={filterBtnRef}
            className={`sp-icon-btn${activeFiltersOn ? " sp-icon-btn--on" : ""}`}
            onClick={() => setShowFilterPanel(true)}
            aria-label="Фільтри"
            tabIndex={0}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* ── Active filter chips ─────────────────────────────────────────── */}
      {activeFiltersOn && (() => {
        const chips = [
          ...activeFilters.genres.map((id) => ({ key: `g-${id}`, label: GENRES.find((g) => g.id === id)?.name, remove: () => setActiveFilters((f) => ({ ...f, genres: f.genres.filter((g) => g !== id) })) })),
          ...activeFilters.countries.map((id) => ({ key: `c-${id}`, label: COUNTRIES.find((c) => c.id === id)?.name, remove: () => setActiveFilters((f) => ({ ...f, countries: f.countries.filter((c) => c !== id) })) })),
          ...(activeFilters.yearMin || activeFilters.yearMax ? [{ key: "year", label: activeFilters.yearMin && activeFilters.yearMax ? `${activeFilters.yearMin}–${activeFilters.yearMax}` : activeFilters.yearMin ? `від ${activeFilters.yearMin}` : `до ${activeFilters.yearMax}`, remove: () => setActiveFilters((f) => ({ ...f, yearMin: null, yearMax: null })) }] : []),
          ...(activeFilters.ratingMin > 0 || activeFilters.ratingMax < 10 ? [{ key: "rating", label: `${activeFilters.ratingMin}–${activeFilters.ratingMax} ★`, remove: () => setActiveFilters((f) => ({ ...f, ratingMin: 0, ratingMax: 10 })) }] : []),
          ...(activeFilters.mediaType !== "all" ? [{ key: "type", label: { movie: "Фільми", tv: "Серіали", animation: "Анімація" }[activeFilters.mediaType], remove: () => setActiveFilters((f) => ({ ...f, mediaType: "all" })) }] : []),
        ].filter((c) => c.label);
        return (
          <div className="sp-active-filters">
            <div className="sp-active-filters__chips">
              {chips.map((c) => (
                <button key={c.key} className="sp-active-chip" tabIndex={0} onClick={c.remove}>
                  {c.label} <X size={11} />
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Virtual keyboard modal ─────────────────────────────────────── */}
      {showKeyboard && (
        <TvKeyboard
          value={draft}
          onChange={setDraft}
          onClose={handleKeyboardClose}
        />
      )}

      {/* ── Filter panel (slides from right) ──────────────────────────── */}
      {showFilterPanel && (
        <FilterPanel
          initial={activeFilters}
          onApply={handleApplyFilters}
          onClose={() => {
            setShowFilterPanel(false);
            requestAnimationFrame(() => filterBtnRef.current?.focus({ preventScroll: true }));
          }}
        />
      )}

      {/* ── DEFAULT STATE — no query, no filters ───────────────────────── */}
      {!query && !activeFiltersOn && (
        <>
          {recentItems.length > 0 && (
            <ContentRow
              title="Нещодавно переглянуті"
              data={recentItems}
              CardComponent={MediaCard}
              cardProps={{ onMovieSelect: handleMovieSelect }}
            />
          )}

          <div className="sp-section">
            <div className="sp-section__head">
              <span className="sp-section__title">Переглядати за жанром</span>
            </div>
            <div className="sp-genre-scroll tv-hscroll">
              {GENRE_TILES.map((g) => (
                <button
                  key={g.id}
                  className="sp-genre-tile"
                  tabIndex={0}
                  onClick={() => setActiveFilters((f) => ({ ...f, genres: [g.id] }))}
                >
                  <span className="sp-genre-tile__name">{g.name}</span>
                  {genreImages[g.id] && (
                    <img className="sp-genre-tile__img" src={genreImages[g.id]} alt="" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {topSearches.length > 0 && (
            <ContentRow
              title="Популярне зараз"
              data={topSearches}
              CardComponent={MediaCard}
              cardProps={{ onMovieSelect: handleMovieSelect }}
            />
          )}
        </>
      )}

      {/* ── RESULTS — query ────────────────────────────────────────────── */}
      {query && (
        isLoading ? (
          <div className="sp-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="sp-skeleton">
                <div className="sp-skeleton__poster sp-shimmer" />
                <div className="sp-skeleton__title sp-shimmer" />
                <div className="sp-skeleton__sub sp-shimmer" />
              </div>
            ))}
          </div>
        ) : hasQueryResults ? (
          <>
            {results.movies.length > 0 && (
              <ContentRow
                title="Фільми"
                data={results.movies.slice(0, 10)}
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
              />
            )}

            {results.tv.length > 0 && (
              <ContentRow
                title="Серіали"
                data={results.tv.slice(0, 10)}
                CardComponent={MediaCard}
                cardProps={{ onMovieSelect: handleMovieSelect }}
              />
            )}

            {results.persons.length > 0 && (
              <div className="sp-section">
                <div className="sp-section__head">
                  <span className="sp-section__title">Персони</span>
                  <ChevronRight size={18} className="sp-section__arrow" />
                </div>
                <div className="sp-persons">
                  {results.persons.map((p, i) => (
                    <div
                      key={i}
                      className="sp-person"
                      tabIndex={0}
                      onClick={() => navigate(`/person/${p.id}`, { state: { backgroundLocation: location.state?.backgroundLocation || location } })}
                    >
                      <img
                        className="sp-person__photo"
                        src={p.profile_path ? tmdbImg(p.profile_path, "w185") : null}
                        alt={p.name}
                      />
                      <div className="sp-person__info">
                        <span className="sp-person__name">{p.name}</span>
                        <span className="sp-person__role">{p.known_for_department}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="sp-empty">
            <p className="sp-empty__title">Нічого не знайдено</p>
            <p className="sp-empty__sub">Немає результатів для «{query}».<br />Спробуйте інший запит.</p>
          </div>
        )
      )}

      {/* ── RESULTS — filters only ─────────────────────────────────────── */}
      {!query && activeFiltersOn && (
        isLoading ? (
          <div className="sp-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="sp-skeleton">
                <div className="sp-skeleton__poster sp-shimmer" />
                <div className="sp-skeleton__title sp-shimmer" />
                <div className="sp-skeleton__sub sp-shimmer" />
              </div>
            ))}
          </div>
        ) : discoverItems.length > 0 ? (
          <div className="sp-grid">
            {discoverItems.map((movie, i) => (
              <div key={movie.id || i} className="sp-grid__item">
                <MediaCard movie={movie} onMovieSelect={handleMovieSelect} type="explorer-card" />
              </div>
            ))}
          </div>
        ) : null
      )}
    </div>
  );
}
