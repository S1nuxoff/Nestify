import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getWatchHistory } from "../api/v3";
import { getLikedMovies } from "../api/user";
import { getMovieDetails, getTvDetails, tmdbImg, tmdbBackdrop } from "../api/tmdb";
import { GENRES } from "../components/ui/FilterPanel";
import MediaCard from "../components/ui/MediaCard";
import BackdropCard from "../components/ui/BackdropCard";
import ContentRow from "../components/section/ContentRow";
import "../styles/LikedPage.css";

// Same curated list as SearchPage for backdrop images
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

const TABS = [
  { key: "recent",    label: "Нещодавні"  },
  { key: "favorites", label: "Улюблені"   },
];

function parseTmdbId(movie_id) {
  const m = String(movie_id || "").match(/^tmdb_(movie|tv)_(\d+)$/);
  return m ? { mediaType: m[1], tmdbId: m[2] } : null;
}

async function enrichLiked(item) {
  const id = item.tmdb_id || item.tmdbId;
  const type = item.tmdb_type || item.mediaType || "movie";
  if (!id) return item;
  try {
    const fn = type === "tv" ? getTvDetails : getMovieDetails;
    const d = await fn(id);
    return {
      ...item,
      tmdbId: String(id),
      mediaType: type,
      filmName: d.title || d.name || item.title || "",
      filmImage: tmdbImg(d.poster_path, "w342"),
      backdrop: tmdbBackdrop(d.backdrop_path, "w1280"),
      filmDecribe: (d.release_date || d.first_air_date || "").slice(0, 4),
      genre: (d.genres || []).map((g) => g.name).slice(0, 1),
    };
  } catch {
    return {
      ...item,
      tmdbId: String(id),
      mediaType: type,
      filmName: item.title || "",
      filmImage: item.image || item.poster || "",
    };
  }
}

async function enrichItem(item) {
  const parsed = parseTmdbId(item.movie_id);
  if (!parsed) return null;
  try {
    const fn = parsed.mediaType === "tv" ? getTvDetails : getMovieDetails;
    const d = await fn(parsed.tmdbId);
    return {
      ...item,
      tmdbId: parsed.tmdbId,
      mediaType: parsed.mediaType,
      filmName: d.title || d.name || "",
      filmImage: tmdbImg(d.poster_path, "w342"),
      backdrop: tmdbBackdrop(d.backdrop_path, "w1280"),
      release_date: (d.release_date || d.first_air_date || "").slice(0, 4),
      genres: (d.genres || []).map((g) => g.name),
    };
  } catch {
    return null;
  }
}


export default function LikedPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("recent");
  const [history, setHistory] = useState([]);
  const [liked, setLiked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genreImages, setGenreImages] = useState({});

  let currentUser = null;
  try { currentUser = JSON.parse(localStorage.getItem("current_user")); } catch {}

  useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getWatchHistory(currentUser.id)
        .then((raw) => Promise.all(raw.map(enrichItem)).then((r) => r.filter(Boolean)))
        .catch(() => []),
      getLikedMovies(currentUser.id)
        .then((raw) => Promise.all((Array.isArray(raw) ? raw : []).map(enrichLiked)))
        .catch(() => []),
    ]).then(([hist, lk]) => {
      setHistory(hist);
      setLiked(lk);
    }).finally(() => setLoading(false));
  }, [currentUser?.id]);

  const continueWatching = useMemo(() =>
    history.filter(
      (m) => m.position_seconds > 30 && m.duration > 0 && m.position_seconds / m.duration < 0.95
    ), [history]);

  const watched = useMemo(() =>
    history.filter((m) => m.duration > 0 && m.position_seconds / m.duration >= 0.95),
    [history]);

  const genres = useMemo(() => {
    const counts = {};
    history.forEach((m) =>
      (m.genres || []).forEach((g) => { counts[g] = (counts[g] || 0) + 1; })
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([g]) => g);
  }, [history]);

  // Load genre backdrop images
  useEffect(() => {
    Promise.all(
      GENRE_TILES.map((g) =>
        getMovieDetails(g.movieId)
          .then((r) => ({ id: g.id, img: r.backdrop_path ? tmdbImg(r.backdrop_path, "w780") : null }))
          .catch(() => ({ id: g.id, img: null }))
      )
    ).then((results) => {
      const map = {};
      results.forEach(({ id, img }) => { map[id] = img; });
      setGenreImages(map);
    });
  }, []);

  const goTo = (item) => {
    const id = item.tmdbId || item.tmdb_id;
    const type = item.mediaType || item.tmdb_type || "movie";
    if (id) navigate(`/title/${type}/${id}`);
  };

  const goToGenre = (genreName) => {
    const found = GENRES.find((g) => g.name === genreName);
    if (found) navigate("/search", { state: { genres: [found.id] } });
  };

  return (
    <div className="lib-root">
      <h1 className="lib-title">Бібліотека</h1>

      <div className="lib-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`lib-tab${tab === t.key ? " lib-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "recent" && (
        <>
          {continueWatching.length > 0 && (
            <ContentRow
              title="Продовжити перегляд"
              data={continueWatching}
              CardComponent={BackdropCard}
              cardProps={{ onMovieSelect: goTo }}
              autoWidth
            />
          )}

          {watched.length > 0 && (
            <ContentRow
              title="Переглянуті"
              data={watched}
              CardComponent={BackdropCard}
              cardProps={{ onMovieSelect: goTo }}
              autoWidth
            />
          )}

          {genres.length > 0 && (
            <section className="lib-section">
              <h2 className="lib-section__title">Жанри які ти дивився</h2>
              <div className="lib-genre-grid">
                {genres.map((name) => {
                  const tile = GENRE_TILES.find((t) => t.name === name);
                  const img = tile ? genreImages[tile.id] : null;
                  return (
                    <button key={name} className="sp-genre-tile" onClick={() => goToGenre(name)}>
                      <span className="sp-genre-tile__name">{name}</span>
                      {img && <img className="sp-genre-tile__img" src={img} alt="" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {!loading && continueWatching.length === 0 && watched.length === 0 && (
            <p className="lib-empty">Ще нічого не дивився</p>
          )}
        </>
      )}

      {tab === "favorites" && (
        <section className="lib-section">
          {liked.length > 0 ? (
            <div className="sp-grid">
              {liked.map((item, i) => (
                <div key={i} className="sp-grid__item">
                  <MediaCard movie={item} onMovieSelect={() => goTo(item)} />
                </div>
              ))}
            </div>
          ) : (
            <p className="lib-empty">Ще немає збережених фільмів</p>
          )}
        </section>
      )}
    </div>
  );
}
