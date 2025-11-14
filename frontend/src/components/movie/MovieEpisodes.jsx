// src/components/movie/MovieEpisodes.jsx
import React, { useState, useEffect } from "react";
import EpisodeSelector from "../ui/EpisodeSelector";
import "../../styles/MoviePage.css";

const MovieEpisodes = ({
  movieDetails,
  selectedSeason,
  onSelectSeason,
  selectedEpisode,
  onSelectEpisode,
}) => {
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const [episodesLoaded, setEpisodesLoaded] = useState(false);

  // есть ли вообще эпизоды
  const hasEpisodes =
    movieDetails &&
    movieDetails.action === "get_stream" &&
    Array.isArray(movieDetails.episodes_schedule) &&
    movieDetails.episodes_schedule.length > 0;

  // карта прогресса по эпизодам
  const episodeHistoryMap = new Map();
  if (
    movieDetails?.watch_history &&
    Array.isArray(movieDetails.watch_history)
  ) {
    movieDetails.watch_history.forEach((h) => {
      if (h.season != null && h.episode != null) {
        const key = `${h.season}-${h.episode}`;
        const existing = episodeHistoryMap.get(key);
        if (
          !existing ||
          new Date(h.updated_at || h.watched_at || 0) >
            new Date(existing.updated_at || existing.watched_at || 0)
        ) {
          episodeHistoryMap.set(key, h);
        }
      }
    });
  }

  // хук ВСЕГДА вызывается, но внутри него мы уже проверяем условия
  useEffect(() => {
    if (!hasEpisodes || !selectedSeason) return;
    setEpisodesLoaded(false);
    const t = setTimeout(() => setEpisodesLoaded(true), 30);
    return () => clearTimeout(t);
  }, [hasEpisodes, selectedSeason, movieDetails?.episodes_schedule]);

  const toggleSeasonDropdown = () => {
    setIsSeasonDropdownOpen((prev) => !prev);
  };

  const handleSeasonClick = (seasonNumber) => {
    onSelectSeason(seasonNumber);
    setIsSeasonDropdownOpen(false);
  };

  if (!hasEpisodes) return null;

  return (
    <section className="movie-page__episodes">
      <div className="movie-page__episodes-header">
        <span className="movie-page__section-title">Серії</span>

        <div
          className="movie-page__season-selector"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="movie-page__season-current"
            onClick={toggleSeasonDropdown}
          >
            {selectedSeason ? `Сезон ${selectedSeason}` : "Оберіть сезон"}
            <span className="movie-page__season-arrow">▾</span>
          </div>

          {isSeasonDropdownOpen && (
            <div className="movie-page__season-list">
              {movieDetails.episodes_schedule.map((season) => (
                <div
                  key={season.season_number}
                  className="movie-page__season-item"
                  onClick={() => handleSeasonClick(season.season_number)}
                >
                  <span className="movie-page__season-title">
                    Сезон {season.season_number}
                  </span>
                  <span className="movie-page__season-count">
                    ({season.episodes.length} серій)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="movie-page__episodes-list">
        {movieDetails.episodes_schedule
          .filter((s) => s.season_number === selectedSeason)
          .flatMap((s) =>
            s.episodes.map((ep, idx) => {
              const epKey = `${s.season_number}-${ep.episode_number}`;
              const hist = episodeHistoryMap.get(epKey);

              let epProgressPercent = null;
              let epIsWatched = false;

              if (
                hist &&
                typeof hist.position_seconds === "number" &&
                typeof hist.duration === "number" &&
                hist.duration > 0
              ) {
                const ratio = Math.min(
                  hist.position_seconds / hist.duration,
                  1
                );
                epProgressPercent = ratio * 100;
                epIsWatched = ratio >= 0.98;
              }

              return (
                <EpisodeSelector
                  key={ep.episode_id}
                  index={idx}
                  isLoaded={episodesLoaded}
                  episde_date={ep.air_date}
                  episde_id={ep.episode_number}
                  episde_title={ep.title}
                  episde_origin={ep.original_title}
                  isSelected={selectedEpisode === ep.episode_number}
                  isWatched={epIsWatched}
                  progressPercent={epProgressPercent}
                  onSelect={onSelectEpisode}
                />
              );
            })
          )}
      </div>
    </section>
  );
};

export default MovieEpisodes;
