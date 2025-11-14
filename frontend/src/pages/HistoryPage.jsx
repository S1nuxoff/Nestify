import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPage, getCategories, getWatchHistory } from "../api/hdrezka";
import Explorer from "../components/layout/Explorer";
import MediaModal from "../components/modal/MediaModal";
import config from "../core/config";
import useMovieDetails from "../hooks/useMovieDetails";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../styles/Category.css";
import { ReactComponent as BackIcon } from "../assets/icons/back.svg";
import { toRezkaSlug } from "../core/rezkaLink";
import "../styles/HistoryPage.css";

function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [categories, setCategories] = useState([]);
  const { movieDetails, loading } = useMovieDetails(
    selectedMovie?.filmLink || selectedMovie?.link
  );
  const handleMovieSelect = (movie) => {
    const rawLink = movie.link || movie.filmLink || movie.navigate_to;
    if (!rawLink) return;

    const slug = toRezkaSlug(rawLink);
    navigate(`/movie/${slug}`);
  };
  const currentUser = JSON.parse(localStorage.getItem("current_user"));
  useEffect(() => {
    (async () => {
      try {
        setHistory(await getWatchHistory(currentUser.id));
      } catch (e) {
        console.error("getWatchHistory error:", e);
      } finally {
      }
    })();
  }, [currentUser.id]);
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
  console.log(history);
  return (
    <>
      <div className="container">
        <Header
          categories={categories}
          onMovieSelect={handleMovieSelect}
          currentUser={currentUser}
        />
        <>
          <div className="history-page__content">
            <Explorer
              Page={history}
              title={"Історія перегляду"}
              currentUser={currentUser}
              onMovieSelect={handleMovieSelect}
            />
          </div>
        </>
        <Footer />
      </div>
    </>
  );
}

export default HistoryPage;
