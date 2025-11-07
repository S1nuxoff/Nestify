// src/hooks/useMovieDetails.js
import { useState, useEffect } from "react";
import { getMovie } from "../api/hdrezka";

const useMovieDetails = (filmLink) => {
  const [movieDetails, setMovieDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!filmLink) {
      setMovieDetails(null);
      setLoading(false); // <--- тут loading=false, а надо true
      return;
    }
    const fetchDetails = async () => {
      setLoading(true);
      setMovieDetails(null); // <--- сбрасывай, чтобы явно был null (и всегда loading=true при новом запросе)
      try {
        const data = await getMovie(filmLink);
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
