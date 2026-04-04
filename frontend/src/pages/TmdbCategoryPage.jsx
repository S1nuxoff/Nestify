import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  discover,
  getPopularMovies,
  getPopularTv,
  getNowPlaying,
  getTopRated,
  getOnTheAir,
  normalizeTmdbItem,
} from "../api/tmdb";
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
    section
      .fetch()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

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

export default function TmdbCategoryPage() {
  const { category } = useParams();
  const navigate = useNavigate();

  const sections = SECTIONS[category] || [];
  const label = CATEGORY_LABELS[category] || "";

  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem("current_user"));
  } catch {}

  const handleMovieSelect = (movie) => {
    navigate(`/title/${movie.mediaType || "movie"}/${movie.tmdbId}`);
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
        <div className="home-page-content">
          <h1 className="category-title">{label}</h1>

          {sections.map((section) => (
            <SectionRow
              key={section.title}
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
