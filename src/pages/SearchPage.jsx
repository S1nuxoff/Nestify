import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { search, getCategories } from "../api/hdrezka";
import Explorer from "../components/layout/Explorer";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import MediaModal from "../components/modal/MediaModal";
import useMovieDetails from "../hooks/useMovieDetails";

export default function SearchPage({ currentUser }) {
  const [params] = useSearchParams();
  const query = params.get("query") || "";
  const [results, setResults] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [categories, setCategories] = useState([]);
  const { movieDetails, loading } = useMovieDetails(
    selectedMovie?.filmLink || selectedMovie?.link
  );

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
        />{" "}
        {/* поиск доступен снова */}
        <div className="category-content">
          <Explorer
            Page={results}
            title={`Результати пошуку: ${query}`} /* ← обратные кавычки + ${} */
            currentUser={currentUser}
            onMovieSelect={setSelectedMovie}
          />
        </div>
        <Footer />
      </div>
    </>
  );
}
