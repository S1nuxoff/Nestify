import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  discover,
  getPopularMovies,
  getPopularTv,
  getNowPlaying,
  getTopRated,
  getOnTheAir,
  normalizeTmdbItem,
} from "../api/tmdb";
import { GENRES } from "../core/pickerFilters";
import Header from "../components/layout/Header";
import ContentRowSwiper from "../components/section/ContentRowSwiper";
import MediaCard from "../components/ui/MediaCard";
import Footer from "../components/layout/Footer";
import "../styles/Category.css";
import "../styles/HomePage.css";

const THIS_YEAR = new Date().getFullYear();
const LAST_YEAR = THIS_YEAR - 1;

// Визначаємо секції для кожної категорії
const SECTIONS = {
  movies: [
    {
      title: "Зараз в кіно",
      fetch: () => getNowPlaying().then((r) => r.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))),
    },
    {
      title: "Популярне",
      fetch: () => getPopularMovies().then((r) => r.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))),
    },
    {
      title: "Топ рейтинг",
      fetch: () => getTopRated("movie").then((r) => r.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))),
    },
    {
      title: `Новинки ${THIS_YEAR}`,
      fetch: () =>
        discover("movie", { primary_release_year: THIS_YEAR }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: `Минулий рік (${LAST_YEAR})`,
      fetch: () =>
        discover("movie", { primary_release_year: LAST_YEAR }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Варто глянути",
      fetch: () =>
        discover("movie", { "vote_average.gte": 7.5, "vote_count.gte": 1000 }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Бойовики",
      fetch: () =>
        discover("movie", { with_genres: "28" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Комедії",
      fetch: () =>
        discover("movie", { with_genres: "35" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Трилери",
      fetch: () =>
        discover("movie", { with_genres: "53" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Жахи",
      fetch: () =>
        discover("movie", { with_genres: "27" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Наукова фантастика",
      fetch: () =>
        discover("movie", { with_genres: "878" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Драми",
      fetch: () =>
        discover("movie", { with_genres: "18" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
  ],

  series: [
    {
      title: "Зараз дивляться",
      fetch: () => getOnTheAir().then((r) => r.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))),
    },
    {
      title: "Популярне",
      fetch: () => getPopularTv().then((r) => r.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))),
    },
    {
      title: "Топ рейтинг",
      fetch: () => getTopRated("tv").then((r) => r.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))),
    },
    {
      title: `Нові серіали ${THIS_YEAR}`,
      fetch: () =>
        discover("tv", { first_air_date_year: THIS_YEAR }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
    {
      title: "Варто глянути",
      fetch: () =>
        discover("tv", { "vote_average.gte": 8.0, "vote_count.gte": 500 }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
    {
      title: "Драми",
      fetch: () =>
        discover("tv", { with_genres: "18" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
    {
      title: "Комедії",
      fetch: () =>
        discover("tv", { with_genres: "35" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
    {
      title: "Кримінал",
      fetch: () =>
        discover("tv", { with_genres: "80" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
    {
      title: "Фантастика",
      fetch: () =>
        discover("tv", { with_genres: "10765" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
    {
      title: "Документальні",
      fetch: () =>
        discover("tv", { with_genres: "99" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
  ],

  animation: [
    {
      title: "Популярне",
      fetch: () =>
        discover("movie", { with_genres: "16" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Топ всіх часів",
      fetch: () =>
        discover("movie", { with_genres: "16", sort_by: "vote_average.desc", "vote_count.gte": 500 }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: `Нові (${THIS_YEAR})`,
      fetch: () =>
        discover("movie", { with_genres: "16", primary_release_year: THIS_YEAR }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Сімейне",
      fetch: () =>
        discover("movie", { with_genres: "16,10751" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Пригоди",
      fetch: () =>
        discover("movie", { with_genres: "16,12" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Серіали (мультфільми)",
      fetch: () =>
        discover("tv", { with_genres: "16" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
  ],

  anime: [
    {
      title: "Популярне",
      fetch: () =>
        discover("tv", { with_genres: "16", with_original_language: "ja" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
    {
      title: "Топ рейтинг",
      fetch: () =>
        discover("tv", {
          with_genres: "16",
          with_original_language: "ja",
          sort_by: "vote_average.desc",
          "vote_count.gte": 300,
        }).then((r) => r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))),
    },
    {
      title: `Аніме ${THIS_YEAR}`,
      fetch: () =>
        discover("tv", { with_genres: "16", with_original_language: "ja", first_air_date_year: THIS_YEAR }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
    {
      title: "Екшн",
      fetch: () =>
        discover("tv", { with_genres: "16,10759", with_original_language: "ja" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
        ),
    },
    {
      title: "Аніме-фільми",
      fetch: () =>
        discover("movie", { with_genres: "16", with_original_language: "ja" }).then((r) =>
          r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
        ),
    },
    {
      title: "Класика",
      fetch: () =>
        discover("tv", {
          with_genres: "16",
          with_original_language: "ja",
          "first_air_date.lte": "2010-01-01",
          sort_by: "vote_average.desc",
          "vote_count.gte": 200,
        }).then((r) => r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))),
    },
  ],
};

const CATEGORY_LABELS = {
  movies: "Фільми",
  series: "Серіали",
  animation: "Мультфільми",
  anime: "Аніме",
};

function SectionRow({ section, onMovieSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    section
      .fetch()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [section]);

  if (!loading && items.length === 0) return null;

  return (
    <ContentRowSwiper
      data={items}
      title={section.title}
      CardComponent={MediaCard}
      cardProps={{ onMovieSelect }}
      rows={2}
      isLoading={loading}
    />
  );
}

function buildGenreQuery(baseGenres, extraGenreId) {
  const ids = [];

  for (const id of baseGenres || []) {
    if (Number.isInteger(id) && !ids.includes(id)) ids.push(id);
  }

  if (Number.isInteger(extraGenreId) && !ids.includes(extraGenreId)) {
    ids.push(extraGenreId);
  }

  return ids.join(",");
}

function getGenreSections(category, genreId) {
  if (!Number.isInteger(genreId)) return [];

  if (category === "movies") {
    return [
      {
        title: "Популярне в жанрі",
        fetch: () =>
          discover("movie", { with_genres: String(genreId) }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
          ),
      },
      {
        title: "Топ рейтинг жанру",
        fetch: () =>
          discover("movie", {
            with_genres: String(genreId),
            sort_by: "vote_average.desc",
            "vote_count.gte": 300,
          }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
          ),
      },
      {
        title: `Новинки жанру ${THIS_YEAR}`,
        fetch: () =>
          discover("movie", {
            with_genres: String(genreId),
            primary_release_year: THIS_YEAR,
          }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
          ),
      },
    ];
  }

  if (category === "series") {
    return [
      {
        title: "Популярні серіали жанру",
        fetch: () =>
          discover("tv", { with_genres: String(genreId) }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
          ),
      },
      {
        title: "Топ рейтинг жанру",
        fetch: () =>
          discover("tv", {
            with_genres: String(genreId),
            sort_by: "vote_average.desc",
            "vote_count.gte": 200,
          }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
          ),
      },
      {
        title: `Нові серіали жанру ${THIS_YEAR}`,
        fetch: () =>
          discover("tv", {
            with_genres: String(genreId),
            first_air_date_year: THIS_YEAR,
          }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
          ),
      },
    ];
  }

  if (category === "animation") {
    const genreQuery = buildGenreQuery([16], genreId);

    return [
      {
        title: "Популярна анімація за жанром",
        fetch: () =>
          discover("movie", { with_genres: genreQuery }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
          ),
      },
      {
        title: "Серіальна анімація",
        fetch: () =>
          discover("tv", { with_genres: genreQuery }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
          ),
      },
      {
        title: `Новинки анімації ${THIS_YEAR}`,
        fetch: () =>
          discover("movie", {
            with_genres: genreQuery,
            primary_release_year: THIS_YEAR,
          }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
          ),
      },
    ];
  }

  if (category === "anime") {
    const genreQuery = buildGenreQuery([16], genreId);

    return [
      {
        title: "Популярне аніме за жанром",
        fetch: () =>
          discover("tv", {
            with_genres: genreQuery,
            with_original_language: "ja",
          }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
          ),
      },
      {
        title: "Аніме-фільми",
        fetch: () =>
          discover("movie", {
            with_genres: genreQuery,
            with_original_language: "ja",
          }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "movie" }))
          ),
      },
      {
        title: `Нове аніме ${THIS_YEAR}`,
        fetch: () =>
          discover("tv", {
            with_genres: genreQuery,
            with_original_language: "ja",
            first_air_date_year: THIS_YEAR,
          }).then((r) =>
            r.results.map((i) => normalizeTmdbItem({ ...i, media_type: "tv" }))
          ),
      },
    ];
  }

  return [];
}

export default function TmdbCategoryPage() {
  const { category } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const sections = SECTIONS[category] || [];
  const label = CATEGORY_LABELS[category] || "";
  const genreOptions = useMemo(() => GENRES.filter((genre) => genre.id !== null), []);
  const activeGenreId = useMemo(() => {
    const raw = Number(searchParams.get("genre"));
    return Number.isInteger(raw) && genreOptions.some((genre) => genre.id === raw)
      ? raw
      : null;
  }, [searchParams, genreOptions]);
  const activeGenre = genreOptions.find((genre) => genre.id === activeGenreId) || null;
  const visibleSections = activeGenreId
    ? getGenreSections(category, activeGenreId)
    : sections;

  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem("current_user"));
  } catch {}

  const handleMovieSelect = (movie) => {
    navigate(`/title/${movie.mediaType || "movie"}/${movie.tmdbId}`);
  };

  const toggleGenre = (genreId) => {
    const nextParams = new URLSearchParams(searchParams);

    if (activeGenreId === genreId) nextParams.delete("genre");
    else nextParams.set("genre", String(genreId));

    setSearchParams(nextParams, { replace: true });
  };

  if (!sections.length) {
    return (
      <div className="container">
        <Header currentUser={currentUser || {}} />
        <div className="movie-page__error">Категорія не знайдена.</div>
      </div>
    );
  }

  return (
    <>
      <div className="container">
        <Header currentUser={currentUser || {}} />
      </div>

      <div className="container">
        <div className="home-page-content pt-16 md:pt-20">
          <div className="mb-1">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">
              Жанри
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {genreOptions.map((genre) => {
                const isActive = activeGenreId === genre.id;

                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.id)}
                    className={`group relative min-w-fit shrink-0 overflow-hidden rounded-[16px] border px-4 py-3 text-left text-[13px] font-semibold transition duration-200 ${
                      isActive
                        ? "border-white/10 bg-white/[0.12] text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)]"
                        : "border-white/[0.05] bg-white/[0.03] text-white hover:border-white/[0.08] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`absolute inset-x-0 top-0 h-px ${
                        isActive ? "bg-white/45" : "bg-transparent"
                      }`}
                    />
                    <span className="block pr-5 leading-[1.2]">{genre.label}</span>
                    <span
                      className={`absolute right-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full transition ${
                        isActive
                          ? "bg-white shadow-[0_0_18px_rgba(255,255,255,0.45)]"
                          : "bg-white/18 group-hover:bg-white/30"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {visibleSections.map((section) => (
            <SectionRow
              key={`${activeGenreId || "all"}-${section.title}`}
              section={section}
              onMovieSelect={handleMovieSelect}
            />
          ))}

          <Footer />
        </div>
      </div>
    </>
  );
}
