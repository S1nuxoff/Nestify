import React from "react";

const MovieActors = ({ actors }) => {
  if (!actors || actors.length === 0) return null;

  return (
    <section className="movie-actors-section">
      <h3 className="row-header-title">Актори та творці</h3>
      <div className="movie-actors__slider">
        {actors.map((actor) => (
          <div key={actor.id} className="actor-card">
            <div className="actor-card__img-wrapper">
              <img src={actor.photo} alt={actor.name} loading="lazy" />
            </div>
            <div className="actor-card__info">
              <div className="actor-card__name">{actor.name}</div>
              <div className="actor-card__role">{actor.job}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MovieActors;
