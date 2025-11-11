// src/pages/SearchPage.jsx
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { search, getCategories } from "../api/hdrezka";
import Explorer from "../components/layout/Explorer";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";

export default function SearchPage({ currentUser }) {
  const [params] = useSearchParams();
  const query = params.get("query") || "";
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);

  const navigate = useNavigate();

  // открываем отдельную страничку фильма
  const handleMovieSelect = (movie) => {
    const link = movie.link || movie.filmLink || movie.navigate_to;
    if (!link) return;
    navigate(`/movie/${encodeURIComponent(link)}`);
  };

  // поиск по query
  useEffect(() => {
    if (!query) return;
    (async () => {
      try {
        const data = await search(query);
        setResults(data);
      } catch (err) {
        console.error("search error:", err);
      }
    })();
  }, [query]);

  // категории для хедера
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { categories: list = [] } = await getCategories();
        setCategories(list);
      } catch (error) {
        console.error("Error fetching main page data:", error);
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

        <div className="category-content">
          <Explorer
            Page={results}
            title={`Результати пошуку: ${query}`}
            currentUser={currentUser}
            onMovieSelect={handleMovieSelect}
          />
        </div>

        <Footer />
      </div>
    </>
  );
}
