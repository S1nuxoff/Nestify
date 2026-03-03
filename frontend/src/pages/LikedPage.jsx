import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getCategories } from "../api/hdrezka";
import { getLikedMovies } from "../api/user";
import Explorer from "../components/layout/Explorer";
import Header from "../components/layout/Header";
import { toRezkaSlug } from "../core/rezkaLink";

import "../styles/Category.css";
import "../styles/HistoryPage.css";

function LikedStats({ liked }) {
  if (!liked || liked.length === 0) return null;

  return (
    <div className="watch-stats">
      <div className="watch-stats__item">
        <span className="watch-stats__value">{liked.length}</span>
        <span className="watch-stats__label">вподобані тайтли</span>
      </div>
    </div>
  );
}

function LikedPage() {
  const navigate = useNavigate();
  const [liked, setLiked] = useState([]);
  const [categories, setCategories] = useState([]);

  let currentUser = null;
  try {
    const raw = localStorage.getItem("current_user");
    currentUser = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("bad current_user in localStorage", e);
  }

  const handleMovieSelect = (movie) => {
    const rawLink = movie.link || movie.filmLink || movie.navigate_to;
    if (!rawLink) return;
    navigate(`/movie/${toRezkaSlug(rawLink)}`);
  };

  useEffect(() => {
    if (!currentUser?.id) return;

    (async () => {
      try {
        const result = await getLikedMovies(currentUser.id);
        setLiked(Array.isArray(result) ? result : []);
      } catch (e) {
        console.error("getLikedMovies error:", e);
      }
    })();
  }, [currentUser?.id]);

  useEffect(() => {
    (async () => {
      try {
        const { categories: list = [] } = await getCategories();
        setCategories(list);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    })();
  }, []);

  return (
    <div className="container">
      <Header
        categories={categories}
        onMovieSelect={handleMovieSelect}
        currentUser={currentUser}
      />
      <div className="page-content">
        <div className="history-page__content">
          <Explorer
            Page={liked}
            title={"Вподобані"}
            currentUser={currentUser}
            onMovieSelect={handleMovieSelect}
            headerExtra={<LikedStats liked={liked} />}
            paginate
            cardType="explorer-card"
          />
        </div>
      </div>
    </div>
  );
}

export default LikedPage;
