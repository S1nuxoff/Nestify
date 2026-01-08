import React, { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPage, getCategories } from "../api/hdrezka";

import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ContentRowSwiper from "../components/section/ContentRowSwiper";
import MediaCard from "../components/ui/MediaCard";

import { toRezkaSlug } from "../core/rezkaLink";
import "../styles/BrowseCategory.css";

function norm(s = "") {
  return String(s).toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

// твоя бизнес-логика типов
const TITLE_TO_TYPE = new Map([
  ["аниме", "animation"],
  ["anime", "animation"],
  ["мультки", "cartoons"],
  ["мультики", "cartoons"],
  ["мультфильмы", "cartoons"],
  ["сериалы", "series"],
  ["серіали", "series"],
  ["фильмы", "films"],
  ["фільми", "films"],
]);

function resolveTypeByTitle(title) {
  return TITLE_TO_TYPE.get(norm(title)) || null;
}

export default function BrowseCategory({ categories: categoriesProp = [] }) {
  const navigate = useNavigate();
  const { categoryTitle } = useParams();
  const decodedTitle = decodeURIComponent(categoryTitle || "");

  const [categories, setCategories] = useState(categoriesProp || []);
  const [bestItems, setBestItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ вычисляем type из урла (аниме/мультки/…)
  const resolvedType = useMemo(
    () => resolveTypeByTitle(decodedTitle),
    [decodedTitle]
  );

  // ✅ ищем категорию по type (самый надежный способ)
  const category = useMemo(() => {
    if (!categories?.length) return null;

    if (resolvedType) {
      const foundByType = categories.find((c) => c?.type === resolvedType);
      if (foundByType) return foundByType;
    }

    // fallback если вдруг нет type или отличается: по title
    const t = norm(decodedTitle);
    return categories.find((c) => norm(c?.title) === t) || null;
  }, [categories, decodedTitle, resolvedType]);

  const subcats = useMemo(() => category?.subcategories || [], [category]);
  const featured = useMemo(() => subcats.slice(0, 8), [subcats]);
  const others = useMemo(() => subcats.slice(8), [subcats]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        let list = categories;

        if (!list?.length) {
          const res = await getCategories();
          list = res?.categories || [];
          setCategories(list);
        }

        // ✅ type берём из урла, а если не получилось — из найденной категории
        const typeForPage = resolvedType || category?.type || "films"; // дефолт на всякий

        const data = await getPage(
          `https://rezka.ag/${typeForPage}/best/2025/`
        );

        setBestItems(Array.isArray(data) ? data : data?.items || []);
      } catch (e) {
        console.error("Fetch error", e);
      } finally {
        setIsLoading(false);
      }
    })();
    // важно: category может поменяться после загрузки categories
  }, [decodedTitle, resolvedType, category?.type, categories.length]);

  const handleSelect = (url) => navigate(`/category${url}`);

  return (
    <div className="page-content">
      <Header
        categories={categories}
        onMovieSelect={(m) => navigate(`/movie/${toRezkaSlug(m.link)}`)}
      />

      <div className="container">
        <main className="browse-main">
          <header className="category-header">
            <span className="section-label">Колекція</span>
            <h1>{decodedTitle}</h1>

            {categories.length > 0 && !category && (
              <div style={{ marginTop: 8, opacity: 0.6, fontSize: 14 }}>
                Не знайдено категорію для <b>{decodedTitle}</b> (type:{" "}
                <b>{resolvedType || "—"}</b>)
              </div>
            )}
          </header>

          <section className="featured-subcats">
            {featured.map((sub) => (
              <div
                key={sub.url}
                className="featured-card"
                onClick={() => handleSelect(sub.url)}
              >
                <span>{sub.title}</span>
              </div>
            ))}
          </section>

          {others.length > 0 && (
            <section className="all-subcats-wrapper">
              <span
                className="section-label"
                style={{ color: "rgba(255,255,255,0.3)", marginBottom: "16px" }}
              >
                Більше категорій
              </span>
              <div className="other-subcats-container">
                {others.map((sub) => (
                  <div
                    key={sub.url}
                    className="mini-chip"
                    onClick={() => handleSelect(sub.url)}
                  >
                    {sub.title}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="best-content-section">
            {!isLoading && bestItems.length > 0 && (
              <ContentRowSwiper
                data={bestItems}
                title={`Найкращі ${decodedTitle} 2025`}
                CardComponent={MediaCard}
                cardProps={{
                  type: "featured",
                  onMovieSelect: (m) =>
                    navigate(`/movie/${toRezkaSlug(m.link)}`),
                }}
                rows={1}
              />
            )}
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
