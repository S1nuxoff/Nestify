import { useState, useEffect } from "react";
import { getMovie } from "../api/hdrezka";

const useMovieDetails = (filmLink) => {
  const [movieDetails, setMovieDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!filmLink) {
      setMovieDetails(null);
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setMovieDetails(null);
      setError(null);

      // достаём userId для этого запроса
      let userId = null;
      try {
        const raw = localStorage.getItem("current_user");
        userId = raw ? JSON.parse(raw)?.id : null;
      } catch (e) {
        console.error("bad current_user in localStorage (useMovieDetails)", e);
      }

      try {
        const data = await getMovie(filmLink, userId);
        setMovieDetails(data);
      } catch (err) {
        setError(err);
      }
      setLoading(false);
    };

    fetchDetails();
  }, [filmLink]);

  return { movieDetails, loading, error };
};

export default useMovieDetails;
