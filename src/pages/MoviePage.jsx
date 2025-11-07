import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import MediaModal from "../components/modal/MediaModal";
import useMovieDetails from "../hooks/useMovieDetails";

function MoviePage({ currentUser }) {
  const { movieLink } = useParams();
  const navigate = useNavigate();

  const decodedLink = movieLink ? decodeURIComponent(movieLink) : null;

  const { movieDetails, loading } = useMovieDetails(decodedLink);

  const handleClose = () => {
    navigate(-1);
  };

  const handleMovieSelect = (movie) => {
    navigate(
      `/movie/${encodeURIComponent(
        movie.link || movie.filmLink || movie.navigate_to
      )}`
    );
  };

  return (
    <>
      <div className="container">
        <Header
          categories={[]}
          currentUser={currentUser}
          onMovieSelect={handleMovieSelect}
        />

        {decodedLink && (
          <MediaModal
            loading={loading}
            movieDetails={movieDetails}
            currentUser={currentUser}
            movie={{ link: decodedLink }}
            onClose={handleClose}
          />
        )}

        <Footer />
      </div>
    </>
  );
}

export default MoviePage;
