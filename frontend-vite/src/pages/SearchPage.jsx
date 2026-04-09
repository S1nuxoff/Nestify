import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Search, SlidersHorizontal, X, ChevronRight } from "lucide-react";
import { searchTmdbMulti, discover, getTrending, normalizeTmdbItem, tmdbImg, getMovieDetails, getTvDetails } from "../api/tmdb";
import { getWatchHistory } from "../api/v3";
import MediaCard from "../components/ui/MediaCard";
import FilterPanel, { GENRES, COUNTRIES } from "../components/ui/FilterPanel";
import Header from "../components/layout/Header";
import "../styles/SearchPage.css";

function normalizeTmdb(item) {
  return normalizeTmdbItem({ ...item, media_type: item.media_type || "movie" });
}

// Genre tiles — movieId is a well-known TMDB movie whose backdrop represents the genre
const GENRE_TILES = [
  { id: "28",    name: "Бойовик",    movieId: 76341  }, // Mad Max: Fury Road
  { id: "18",    name: "Драма",      movieId: 278    }, // The Shawshank Redemption
  { id: "35",    name: "Комедія",    movieId: 120467 }, // The Grand Budapest Hotel
  { id: "53",    name: "Трилер",     movieId: 27205  }, // Inception
  { id: "27",    name: "Жахи",       movieId: 419430 }, // Get Out
  { id: "878",   name: "Фантастика", movieId: 438631 }, // Dune
  { id: "12",    name: "Пригоди",    movieId: 329    }, // Jurassic Park
  { id: "16",    name: "Анімація",   movieId: 129    }, // Spirited Away
  { id: "10749", name: "Мелодрама",  movieId: 313369 }, // La La Land
  { id: "80",    name: "Кримінал",   movieId: 238    }, // The Godfather
];

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
  const [activeFilters, setActiveFilters] = useState(() => {
    const stateGenres = location.state?.genres || [];
    return {
      mediaType: "all", genres: stateGenres, countries: [], yearMin: null, yearMax: null,
      ratingMin: 0, ratingMax: 10, sortBy: "popularity.desc",
    };
  });

  // Discovery state (no query, no filters)
  const [recentItems, setRecentItems] = useState([]);
  const [genreImages, setGenreImages] = useState({}); // genreId → posterUrl
  const [topSearches, setTopSearches] = useState([]);

  const inputRef = useRef(null);

  let currentUser = null;
  try { const raw = localStorage.getItem("current_user"); currentUser = raw ? JSON.parse(raw) : null; } catch {}

  const isDefaultState = !query && !hasActiveFilters();

  function hasActiveFilters() {
    return activeFilters.genres.length > 0 || activeFilters.countries.length > 0 ||
      activeFilters.yearMin || activeFilters.yearMax ||
      activeFilters.ratingMin > 0 || activeFilters.ratingMax < 10 ||
      activeFilters.mediaType !== "all";
  }

  // Load discovery data (recent, genres, top)
  useEffect(() => {
    if (!isDefaultState) return;

    // Recent from watch history
    if (currentUser?.id) {
      getWatchHistory(currentUser.id).then(async (raw) => {
        const unique = [];
        const seen = new Set();
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

    // Genre images — fetch backdrop of a curated iconic movie per genre
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

    // Top searches — trending
    getTrending("week").then((items) => {
      setTopSearches(items.slice(0, 10).map(normalizeTmdb));
    }).catch(() => {});
  }, [isDefaultState]);

  // Filtered discover
  useEffect(() => {
    if (isDefaultState) return;
    if (query) return;
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
        const types = mediaType === "all" ? ["movie", "tv"] : ["movie", "tv"].filter(() => mediaType !== "animation" || true).slice(0, mediaType === "all" ? 2 : 1).map(() => mediaType === "animation" ? "movie" : mediaType);
        const fetches = (mediaType === "all" ? ["movie", "tv"] : mediaType === "animation" ? ["movie", "tv"] : [mediaType]).map((t) =>
          discover(t, mediaType === "animation" ? { ...p, with_genres: [...genres, "16"].join(",") } : p)
            .then((r) => r.results.map((i) => normalizeTmdbItem({ ...i, media_type: t })))
            .catch(() => [])
        );
        const arrays = await Promise.all(fetches);
        setDiscoverItems(arrays.flat().sort(() => Math.random() - 0.5).slice(0, 40));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [activeFilters, query, isDefaultState]);

  // Search
  useEffect(() => {
    if (!query) { setResults({ movies: [], tv: [], persons: [] }); return; }
    (async () => {
      setIsLoading(true);
      try {
        const data = await searchTmdbMulti(query);
        const movies = data.filter((r) => r.media_type === "movie").map(normalizeTmdb);
        const tv = data.filter((r) => r.media_type === "tv").map(normalizeTmdb);
        const persons = data.filter((r) => r.media_type === "person").slice(0, 5);
        setResults({ movies, tv, persons });
      } catch {
        setResults({ movies: [], tv: [], persons: [] });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [query]);

  useEffect(() => { setDraft(query); }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q) { setParams((p) => { p.delete("query"); return p; }, { replace: true }); return; }
    setParams((p) => { p.set("query", q); return p; }, { replace: true });
  };

  const handleMovieSelect = (movie) => {
    navigate(`/title/${movie.mediaType || "movie"}/${movie.tmdbId}`);
  };

  const handleApplyFilters = (filters) => {
    setActiveFilters(filters);
    setShowFilterPanel(false);
  };

  const activeFiltersOn = hasActiveFilters();
  const displayItems = discoverItems;
  const hasQueryResults = results.movies.length > 0 || results.tv.length > 0 || results.persons.length > 0;

  return (
    <div className="sp-root">
      <Header currentUser={currentUser || {}} />

      <h1 className="sp-heading">Каталог</h1>

      {/* Search bar */}
      <div className="sp-searchbar">
        <form className="sp-searchbar__form" onSubmit={handleSubmit}>
          <Search size={18} className="sp-searchbar__icon" />
          <input
            ref={inputRef}
            className="sp-searchbar__input"
            type="search"
            placeholder="Пошук"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          {draft && (
            <button type="button" className="sp-searchbar__clear"
              onClick={() => { setDraft(""); setParams((p) => { p.delete("query"); return p; }, { replace: true }); }}>
              <X size={14} />
            </button>
          )}
        </form>
        <button
          className={`sp-filter-btn${activeFiltersOn ? " is-active" : ""}`}
          onClick={() => setShowFilterPanel(true)}
          aria-label="Фільтри"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Active filter chips */}
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
                <button key={c.key} className="sp-active-chip" onClick={c.remove}>
                  {c.label} <X size={11} />
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Filter panel */}
      {showFilterPanel && (
        <FilterPanel initial={activeFilters} onApply={handleApplyFilters} onClose={() => setShowFilterPanel(false)} />
      )}

      {/* DEFAULT STATE — no query, no filters */}
      {!query && !activeFiltersOn && (
        <>
          {/* Recently watched */}
          {recentItems.length > 0 && (
            <div className="sp-section">
              <div className="sp-section__head">
                <span className="sp-section__title">Нещодавно переглянуті</span>
              </div>
              <div className="sp-hscroll">
                {recentItems.map((m, i) => (
                  <div key={i} className="sp-hscroll__item">
                    <MediaCard movie={m} onMovieSelect={handleMovieSelect} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Browse by Genre */}
          <div className="sp-section">
            <div className="sp-section__head">
              <span className="sp-section__title">Переглядати за жанром</span>
            </div>
            <div className="sp-genre-scroll">
              {GENRE_TILES.map((g) => (
                <button
                  key={g.id}
                  className="sp-genre-tile"
                  onClick={() => {
                    setActiveFilters((f) => ({ ...f, genres: [g.id] }));
                  }}
                >
                  <span className="sp-genre-tile__name">{g.name}</span>
                  {genreImages[g.id] && (
                    <img className="sp-genre-tile__img" src={genreImages[g.id]} alt="" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Top searches */}
          {topSearches.length > 0 && (
            <div className="sp-section">
              <div className="sp-section__head">
                <span className="sp-section__title">Популярне зараз</span>
              </div>
              <div className="sp-hscroll">
                {topSearches.map((m, i) => (
                  <div key={i} className="sp-hscroll__item">
                    <MediaCard movie={m} onMovieSelect={handleMovieSelect} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* RESULTS — query */}
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
            {/* Movies section */}
            {results.movies.length > 0 && (
              <div className="sp-section">
                <div className="sp-section__head">
                  <span className="sp-section__title">Фільми</span>
                  <ChevronRight size={18} className="sp-section__arrow" />
                </div>
                <div className="sp-hscroll">
                  {results.movies.slice(0, 10).map((m, i) => (
                    <div key={i} className="sp-hscroll__item">
                      <MediaCard movie={m} onMovieSelect={handleMovieSelect} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TV section */}
            {results.tv.length > 0 && (
              <div className="sp-section">
                <div className="sp-section__head">
                  <span className="sp-section__title">Серіали</span>
                  <ChevronRight size={18} className="sp-section__arrow" />
                </div>
                <div className="sp-hscroll">
                  {results.tv.slice(0, 10).map((m, i) => (
                    <div key={i} className="sp-hscroll__item">
                      <MediaCard movie={m} onMovieSelect={handleMovieSelect} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Persons section */}
            {results.persons.length > 0 && (
              <div className="sp-section">
                <div className="sp-section__head">
                  <span className="sp-section__title">Персони</span>
                  <ChevronRight size={18} className="sp-section__arrow" />
                </div>
                <div className="sp-persons">
                  {results.persons.map((p, i) => (
                    <div key={i} className="sp-person" onClick={() => navigate(`/person/${p.id}`, { state: { backgroundLocation: location.state?.backgroundLocation || location } })}>
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

      {/* RESULTS — filters only */}
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
        ) : displayItems.length > 0 ? (
          <div className="sp-grid">
            {displayItems.map((movie, i) => (
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
