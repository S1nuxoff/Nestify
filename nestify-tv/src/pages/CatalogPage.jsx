// src/pages/CatalogPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getPage, getCategories } from "../api/hdrezka";

import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import Explorer from "../components/layout/Explorer";
import Pagination from "../components/layout/Pagination";
import ContentRowSwiper from "../components/section/ContentRowSwiper";
import MediaCard from "../components/ui/MediaCard";

import { toRezkaSlug } from "../core/rezkaLink";
import config from "../core/config";

import "../styles/BrowseCategory.css";
import "../styles/Category.css";

function norm(s = "") {
  return String(s).toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

// твоя бізнес-логіка типів
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

export default function CatalogPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("current_user"));
    } catch {
      return null;
    }
  }, []);

  // ✅ режим: browse vs category
  const isBrowse = location.pathname.startsWith("/browse");

  // -------------------------
  // Общие стейты
  // -------------------------
  const [categories, setCategories] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [pageData, setPageData] = useState({
    items: [],
    pages_count: 1,
    title: "",
  }); // для category-режима
  const [bestItems, setBestItems] = useState([]); // для browse-режима

  // -------------------------
  // Browse mode: categoryTitle
  // -------------------------
  const decodedTitle = useMemo(() => {
    const raw = params.categoryTitle || "";
    return decodeURIComponent(raw);
  }, [params.categoryTitle]);

  const resolvedType = useMemo(
    () => resolveTypeByTitle(decodedTitle),
    [decodedTitle]
  );

  const category = useMemo(() => {
    if (!categories?.length) return null;

    // 1) по type
    if (resolvedType) {
      const foundByType = categories.find((c) => c?.type === resolvedType);
      if (foundByType) return foundByType;
    }

    // 2) fallback по title
    const t = norm(decodedTitle);
    return categories.find((c) => norm(c?.title) === t) || null;
  }, [categories, decodedTitle, resolvedType]);

  const subcats = useMemo(() => category?.subcategories || [], [category]);
  const featured = useMemo(() => subcats.slice(0, 8), [subcats]);
  const others = useMemo(() => subcats.slice(8), [subcats]);

  // -------------------------
  // Category mode: url building
  // -------------------------
  const backendPath = useMemo(() => {
    if (isBrowse) return "";
    return location.pathname
      .replace(/^\/category/, "")
      .replace(/\/{2,}/g, "/")
      .replace(/\/+$/, "");
  }, [location.pathname, isBrowse]);

  const fullUrl = useMemo(() => {
    if (isBrowse) return "";
    return config.hdrezk_url + backendPath + location.search;
  }, [isBrowse, backendPath, location.search]);

  const baseUrl = useMemo(() => {
    if (isBrowse) return "";
    return "/category" + backendPath.replace(/\/page\/\d+\/?$/, "");
  }, [isBrowse, backendPath]);

  // -------------------------
  // Scroll top on navigation
  // -------------------------
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, location.search]);

  // -------------------------
  // Load categories (once)
  // -------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      if (categories?.length) return;
      setIsCategoriesLoading(true);
      try {
        const res = await getCategories();
        const list = res?.categories || [];
        if (!alive) return;
        setCategories(list);
      } catch (e) {
        console.error("Error fetching categories:", e);
      } finally {
        if (alive) setIsCategoriesLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // один раз

  // -------------------------
  // Fetch data depending on mode
  // -------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      setIsLoading(true);

      try {
        if (isBrowse) {
          // ✅ browse: грузим best 2025 по resolvedType
          const typeForPage = resolvedType || category?.type || "films";
          const data = await getPage(
            `https://rezka.ag/${typeForPage}/best/2025/`
          );
          if (!alive) return;
          setBestItems(Array.isArray(data) ? data : data?.items || []);
        } else {
          // ✅ category: грузим листинг
          const data = await getPage(fullUrl);
          if (!alive) return;
          setPageData(data);
        }
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    isBrowse,
    // browse dependencies
    resolvedType,
    category?.type,
    decodedTitle,
    // category dependencies
    fullUrl,
    location.pathname,
    location.search,
  ]);

  // -------------------------
  // Common handlers
  // -------------------------
  const handleMovieSelect = (movie) => {
    const rawLink = movie?.link || movie?.filmLink || movie?.navigate_to;
    if (!rawLink) return;
    navigate(`/movie/${toRezkaSlug(rawLink)}`);
  };

  const handleSubcategorySelect = (url) => navigate(`/category${url}`);

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="page-content">
      <Header
        categories={categories}
        onMovieSelect={handleMovieSelect}
        currentUser={currentUser}
      />

      <div className="container">
        {isBrowse ? (
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
                  onClick={() => handleSubcategorySelect(sub.url)}
                  role="button"
                >
                  <span>{sub.title}</span>
                </div>
              ))}
            </section>

            {others.length > 0 && (
              <section className="all-subcats-wrapper">
                <span
                  className="section-label"
                  style={{
                    color: "rgba(255,255,255,0.3)",
                    marginBottom: "16px",
                  }}
                >
                  Більше категорій
                </span>
                <div className="other-subcats-container">
                  {others.map((sub) => (
                    <div
                      key={sub.url}
                      className="mini-chip"
                      onClick={() => handleSubcategorySelect(sub.url)}
                      role="button"
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

              {isLoading && (
                <div className="spinner-wrapper">
                  <div className="spinner"></div>
                </div>
              )}
            </section>
          </main>
        ) : (
          <main className="category-main">
            {isLoading ? (
              <div className="spinner-wrapper">
                <div className="spinner"></div>
              </div>
            ) : (
              <div className="category-content">
                <Explorer
                  Page={pageData.items}
                  title={pageData.title}
                  currentUser={currentUser}
                  onMovieSelect={handleMovieSelect}
                />
                <Pagination
                  totalPages={pageData.pages_count}
                  baseUrl={baseUrl}
                />
              </div>
            )}
          </main>
        )}
      </div>

      {/* якщо у тебе Footer десь вимкнений — можеш лишити як було */}
      <Footer />
    </div>
  );
}
