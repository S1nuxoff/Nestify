import { useEffect, useState } from "react";
import { getCollections, getCategories } from "../api/hdrezka";
import MediaModal from "../components/modal/MediaModal";
import "../styles/CollectionsPage.css";
import useMovieDetails from "../hooks/useMovieDetails";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { useNavigate } from "react-router-dom";
import { ReactComponent as BackIcon } from "../assets/icons/back.svg";

import CollectionCard from "../components/ui/CollectionCard";

function CollectionsPage() {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(20);

  const [selectedMovie, setSelectedMovie] = useState(null);
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const { movieDetails, loading } = useMovieDetails(
    selectedMovie?.filmLink || selectedMovie?.link
  );
  const currentUser = JSON.parse(localStorage.getItem("current_user"));

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
      try {
        const list = await getCollections(); // просто массив
        setCollections(list); // сохраняем напрямую
      } catch (error) {
        console.error("Error fetching collections:", error);
      }
    };
    fetchData();
  }, []);
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 300
      ) {
        setVisibleCount((prev) => prev + 20); // Подгружаем ещё 20
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
        <div className="collections-content">
          <div className="category-content-top">
            <div className="category-content-title">
              <BackIcon
                style={{ cursor: "pointer" }}
                onClick={() => navigate(-1)} // ⬅ назад в истории
              />

              <span className="row-header-title">Колекції</span>
            </div>
          </div>

          <div className="collection-container">
            {collections.slice(0, visibleCount).map((collection) => (
              <CollectionCard
                key={collection.filename}
                collection={collection}
              />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}

export default CollectionsPage;
