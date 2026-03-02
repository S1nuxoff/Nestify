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

function getFunFact(totalSeconds) {
  const hours = totalSeconds / 3600;
  if (hours >= 48) return { value: `${(hours / 24).toFixed(1)}`, label: "доби без сну" };
  if (hours >= 10) return { value: `${Math.floor(hours / 10)}`, label: "перельоти Київ → NY" };
  return { value: `${Math.floor(totalSeconds / (45 * 60))}`, label: "серії по 45 хв" };
}

function WatchStats({ history }) {
  if (!history || history.length === 0) return null;
  const totalSeconds = history.reduce((sum, m) => sum + (m.position || 0), 0);
  if (totalSeconds < 60) return null;

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const timeValue = h > 0 ? `${h}г ${m}хв` : `${m}хв`;
  const funFact = getFunFact(totalSeconds);

  return (
    <div className="watch-stats">
      <div className="watch-stats__item">
        <span className="watch-stats__value">{timeValue}</span>
        <span className="watch-stats__label">переглянуто</span>
      </div>
      <div className="watch-stats__item">
        <span className="watch-stats__value">{history.length}</span>
        <span className="watch-stats__label">тайтлів</span>
      </div>
      <div className="watch-stats__item">
        <span className="watch-stats__value">{funFact.value}</span>
        <span className="watch-stats__label">{funFact.label}</span>
      </div>
    </div>
  );
}

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
        setHistory(await getWatchHistory(currentUser.id, false));
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

  return (
    <>
      <div className="container">
        <Header
          categories={categories}
          onMovieSelect={handleMovieSelect}
          currentUser={currentUser}
        />
        <>
          <div className="page-content">
            <div className="history-page__content">
              <Explorer
                Page={history}
                title={"Історія перегляду"}
                currentUser={currentUser}
                onMovieSelect={handleMovieSelect}
                headerExtra={<WatchStats history={history} />}
                paginate
                cardType="history"
              />
            </div>
          </div>
        </>
        {/* <Footer /> */}
      </div>
    </>
  );
}

export default HistoryPage;
