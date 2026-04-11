// src/pages/BrowsePage.jsx
import React, { useMemo, useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getPage, getCategories } from "../api/hdrezka";

import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import Explorer from "../components/layout/Explorer";
import Pagination from "../components/layout/Pagination";

import { toRezkaSlug } from "../core/rezkaLink";
import config from "../core/config";

import "../styles/BrowseCategory.css";
import "../styles/Category.css";

function norm(s = "") {
  return String(s).toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

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

export default function BrowsePage({ categories: categoriesProp = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { categoryTitle } = useParams();

  const decodedTitle = useMemo(
    () => decodeURIComponent(categoryTitle || ""),
    [categoryTitle]
  );

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("current_user"));
    } catch {
      return null;
    }
  }, []);

  // -----------------------------
  // Categories
  // -----------------------------
  const [categories, setCategories] = useState(categoriesProp || []);
  const [isCatsLoading, setIsCatsLoading] = useState(false);

  const resolvedType = useMemo(
    () => resolveTypeByTitle(decodedTitle),
    [decodedTitle]
  );

  const category = useMemo(() => {
    if (!categories?.length) return null;

    if (resolvedType) {
      const foundByType = categories.find((c) => c?.type === resolvedType);
      if (foundByType) return foundByType;
    }

    const t = norm(decodedTitle);
    return categories.find((c) => norm(c?.title) === t) || null;
  }, [categories, decodedTitle, resolvedType]);

  const subcats = useMemo(() => category?.subcategories || [], [category]);

  // -----------------------------
  // Listing (movies)
  // -----------------------------
  const [isLoading, setIsLoading] = useState(true);
  const [pageData, setPageData] = useState({
    items: [],
    pages_count: 1,
    title: "",
  });

  // selected subcategory url (?sub=)
  const selectedSubUrl = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const sub = sp.get("sub");
    if (sub) return sub;
    return subcats?.[0]?.url || null;
  }, [location.search, subcats]);

  // baseUrl for pagination inside browse
  const baseUrl = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    if (selectedSubUrl) sp.set("sub", selectedSubUrl);
    sp.delete("page");
    const qs = sp.toString();
    return `/browse/${encodeURIComponent(decodedTitle)}${qs ? `?${qs}` : ""}`;
  }, [decodedTitle, location.search, selectedSubUrl]);

  // current page
  const page = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const p = parseInt(sp.get("page") || "1", 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  }, [location.search]);

  // full URL for backend
  const fullUrl = useMemo(() => {
    if (!selectedSubUrl) return "";
    let path = selectedSubUrl.replace(/\/{2,}/g, "/");

    if (page > 1) {
      path = path.replace(/\/page\/\d+\/?$/, "");
      if (!path.endsWith("/")) path += "/";
      path += `page/${page}/`;
    }

    return config.hdrezk_url + path;
  }, [selectedSubUrl, page]);

  // -----------------------------
  // Effects
  // -----------------------------
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [decodedTitle, selectedSubUrl, page]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (categories?.length) return;
      setIsCatsLoading(true);
      try {
        const res = await getCategories();
        const list = res?.categories || [];
        if (!alive) return;
        setCategories(list);
      } catch (e) {
        console.error("Error fetching categories:", e);
      } finally {
        if (alive) setIsCatsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!fullUrl) {
        setPageData({ items: [], pages_count: 1, title: "" });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await getPage(fullUrl);
        if (!alive) return;
        setPageData(data);
      } catch (e) {
        console.error("Error fetching browse listing:", e);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [fullUrl]);

  // -----------------------------
  // Handlers
  // -----------------------------
  const handleMovieSelect = useCallback(
    (movie) => {
      const rawLink = movie?.link || movie?.filmLink || movie?.navigate_to;
      if (!rawLink) return;
      navigate(`/movie/${toRezkaSlug(rawLink)}`);
    },
    [navigate]
  );

  const setSub = useCallback(
    (url) => {
      const sp = new URLSearchParams(location.search);
      sp.set("sub", url);
      sp.set("page", "1");
      navigate(`/browse/${encodeURIComponent(decodedTitle)}?${sp.toString()}`, {
        replace: false,
      });
    },
    [location.search, navigate, decodedTitle]
  );

  const setPage = useCallback(
    (p) => {
      const sp = new URLSearchParams(location.search);
      sp.set("page", String(p));
      navigate(`/browse/${encodeURIComponent(decodedTitle)}?${sp.toString()}`);
    },
    [location.search, navigate, decodedTitle]
  );

  const listingTitle = useMemo(() => {
    const subObj = subcats.find((s) => s?.url === selectedSubUrl);
    return subObj?.title || pageData?.title || decodedTitle;
  }, [subcats, selectedSubUrl, pageData?.title, decodedTitle]);

  const onKeySelectSub = (url) => (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSub(url);
    }
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="page-content">
      <Header
        categories={categories}
        onMovieSelect={handleMovieSelect}
        currentUser={currentUser}
      />

      <div className="container">
        <main className="browse-main">
          {/* HERO / TITLE */}
          <header className="category-header">
            <h1>{decodedTitle}</h1>

            {isCatsLoading && (
              <div style={{ marginTop: 8, opacity: 0.5, fontSize: 13 }}>
                Завантаження категорій…
              </div>
            )}

            {categories.length > 0 && !category && (
              <div style={{ marginTop: 8, opacity: 0.6, fontSize: 14 }}>
                Не знайдено категорію для <b>{decodedTitle}</b> (type:{" "}
                <b>{resolvedType || "—"}</b>)
              </div>
            )}
          </header>

          {/* ✅ ALL SUBCATEGORIES = ONE SLIDER OF SMALL CARDS */}
          {subcats.length > 0 && (
            <section className="subcat-block">
              <div className="subcat-slider subcat-slider--all">
                {subcats.map((sub) => {
                  const active = sub.url === selectedSubUrl;
                  return (
                    <div
                      key={sub.url}
                      className={`featured-card featured-card--sm ${
                        active ? "is-active" : ""
                      }`}
                      onClick={() => setSub(sub.url)}
                      onKeyDown={onKeySelectSub(sub.url)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={active}
                      title={sub.title}
                    >
                      <span>{sub.title}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* MOVIES LISTING */}
          <section className="category-content" style={{ marginTop: 18 }}>
            {isLoading ? (
              <div className="spinner-wrapper">
                <div className="spinner"></div>
              </div>
            ) : (
              <>
                <Explorer
                  Page={pageData.items}
                  title={listingTitle}
                  currentUser={currentUser}
                  onMovieSelect={handleMovieSelect}
                />

                <Pagination
                  totalPages={pageData.pages_count}
                  baseUrl={baseUrl}
                  onPageChange={setPage}
                  currentPage={page}
                />
              </>
            )}
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
