import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPage, getCategories } from "../api/hdrezka";
import Explorer from "../components/layout/Explorer";
import MediaModal from "../components/modal/MediaModal";

import config from "../core/config";
import useMovieDetails from "../hooks/useMovieDetails";
import Header from "../components/layout/Header";
import Pagination from "../components/layout/Pagination";
import Footer from "../components/layout/Footer";
import "../styles/Category.css";
import { ReactComponent as BackIcon } from "../assets/icons/back.svg";

function CategoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pageData, setPageData] = useState({ items: [], pages_count: 1 });
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [categories, setCategories] = useState([]);
  const { movieDetails, loading } = useMovieDetails(
    selectedMovie?.filmLink || selectedMovie?.link
  );
  const currentUser = JSON.parse(localStorage.getItem("current_user"));
  const [isLoading, setIsLoading] = useState(true);

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
    const fetchData = async () => {
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

    fetchData();
  }, [location.pathname, location.search]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { categories: list = [] } = await getCategories();
        setCategories(list);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchData();
  }, []);
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true); // ⬅️ показать спиннер
      try {
        const data = await getPage(fullUrl);
        setPageData(data);
      } catch (err) {
        console.error("Error fetching category page:", err);
      } finally {
        setIsLoading(false); // ⬅️ скрыть спиннер
      }
    };

    fetchData();
  }, [location.pathname]);

  return (
    <>
      {selectedMovie && (
        <MediaModal
          loading={loading}
          movieDetails={movieDetails}
          currentUser={currentUser}
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
        />
      )}

      <div className="container">
        <Header
          categories={categories}
          onMovieSelect={setSelectedMovie}
          currentUser={currentUser}
        />
        <>
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
                onMovieSelect={setSelectedMovie}
              />
              <Pagination totalPages={pageData.pages_count} baseUrl={baseUrl} />
            </div>
          )}
        </>
        <Footer />
      </div>
    </>
  );
}

export default CategoryPage;
