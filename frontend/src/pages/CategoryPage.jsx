// src/pages/CategoryPage.jsx
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPage, getCategories } from "../api/hdrezka";
import Explorer from "../components/layout/Explorer";
import { toRezkaSlug } from "../core/rezkaLink";
import config from "../core/config";
import Header from "../components/layout/Header";
import Pagination from "../components/layout/Pagination";
import Footer from "../components/layout/Footer";
import "../styles/Category.css";

function CategoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pageData, setPageData] = useState({ items: [], pages_count: 1 });
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = JSON.parse(localStorage.getItem("current_user"));

  const backendPath = location.pathname
    .replace(/^\/category/, "")
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");

  const fullUrl = config.hdrezk_url + backendPath + location.search;
  const baseUrl = "/category" + backendPath.replace(/\/page\/\d+\/?$/, "");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  useEffect(() => {
    const fetchPage = async () => {
      setIsLoading(true);
      try {
        const data = await getPage(fullUrl);
        setPageData(data);
      } catch (err) {
        console.error("Error fetching category page:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPage();
  }, [location.pathname, location.search, fullUrl]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { categories: list = [] } = await getCategories();
        setCategories(list);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // 👇 тепер при виборі фільму завжди відкриваємо MoviePage
  const handleMovieSelect = (movie) => {
    const rawLink = movie.link || movie.filmLink || movie.navigate_to;
    if (!rawLink) return;

    const slug = toRezkaSlug(rawLink);
    navigate(`/movie/${slug}`);
  };

  return (
    <div className="container">
      <Header
        categories={categories}
        onMovieSelect={handleMovieSelect} // ⬅️ замість setSelectedMovie
        currentUser={currentUser}
      />
      <div className="page-content">
        <div className="page-content"></div>
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
              onMovieSelect={handleMovieSelect} // ⬅️ теж відкриваємо сторінку
            />
            <Pagination totalPages={pageData.pages_count} baseUrl={baseUrl} />
          </div>
        )}
      </div>

      {/* <Footer /> */}
    </div>
  );
}

export default CategoryPage;
