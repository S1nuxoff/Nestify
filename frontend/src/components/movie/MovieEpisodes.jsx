// src/components/movie/MovieEpisodes.jsx
import React, { useState, useEffect, useRef } from "react";
import EpisodeSelector from "../ui/EpisodeSelector";
import "../../styles/MoviePage.css";

const MovieEpisodes = ({
  movieDetails,
  selectedSeason,
  onSelectSeason,
  selectedEpisode,
  onSelectEpisode,
  seasonEpisodes = [],
  seasonLoading = false,
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

  const seasonListRef = useRef(null);

  const toggleSeasonDropdown = () => {
    setIsSeasonDropdownOpen((prev) => !prev);
  };

  const handleSeasonClick = (seasonNumber) => {
    onSelectSeason(seasonNumber);
    setIsSeasonDropdownOpen(false);
  };

  // When dropdown opens, auto-focus the first season item for TV remote
  useEffect(() => {
    if (!isSeasonDropdownOpen) return;
    const timer = setTimeout(() => {
      const first = seasonListRef.current?.querySelector('.tv-focusable');
      if (first) first.focus({ preventScroll: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [isSeasonDropdownOpen]);

  if (!hasEpisodes) return null;

  return (
    <section className="movie-page__episodes">
      <div className="movie-page__episodes-header">
        <span className="row-header-title">Серії</span>

        <div
          className="movie-page__season-selector"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="movie-page__season-current tv-focusable"
            onClick={toggleSeasonDropdown}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSeasonDropdown();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setIsSeasonDropdownOpen(false);
              }
            }}
            tabIndex={0}
            role="button"
            aria-haspopup="listbox"
            aria-expanded={isSeasonDropdownOpen}
          >
            {selectedSeason ? `Сезон ${selectedSeason}` : "Оберіть сезон"}
            <span className="movie-page__season-arrow">▾</span>
          </div>

          {isSeasonDropdownOpen && (
            <div className="movie-page__season-list" ref={seasonListRef} role="listbox">
              {movieDetails.episodes_schedule.map((season) => (
                <div
                  key={season.season_number}
                  className="movie-page__season-item tv-focusable"
                  onClick={() => handleSeasonClick(season.season_number)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSeasonClick(season.season_number);
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsSeasonDropdownOpen(false);
                    }
                  }}
                  tabIndex={0}
                  role="option"
                  aria-selected={selectedSeason === season.season_number}
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
        {seasonLoading && (
          <div className="movie-page__episodes-loading">
            <div className="spinner" />
          </div>
        )}

        {!seasonLoading && seasonEpisodes.length > 0 &&
          seasonEpisodes.map((ep, idx) => {
            const epKey = `${selectedSeason}-${ep.episode_number}`;
            const hist = episodeHistoryMap.get(epKey);

            let epProgressPercent = null;
            let epIsWatched = false;

            if (
              hist &&
              typeof hist.position_seconds === "number" &&
              typeof hist.duration === "number" &&
              hist.duration > 0
            ) {
              const ratio = Math.min(hist.position_seconds / hist.duration, 1);
              epProgressPercent = ratio * 100;
              epIsWatched = ratio >= 0.98;
            }

            return (
              <EpisodeSelector
                key={ep.id || idx}
                index={idx}
                isLoaded={episodesLoaded}
                episde_id={ep.episode_number}
                episde_title={ep.name}
                episde_overview={ep.overview}
                episde_date={ep.air_date}
                episde_still={ep.still_path}
                isSelected={selectedEpisode === ep.episode_number}
                isWatched={epIsWatched}
                progressPercent={epProgressPercent}
                onSelect={onSelectEpisode}
              />
            );
          })
        }

        {!seasonLoading && seasonEpisodes.length === 0 &&
          movieDetails.episodes_schedule
            .filter((s) => s.season_number === selectedSeason)
            .flatMap((s) =>
              s.episodes.map((ep, idx) => (
                <EpisodeSelector
                  key={idx}
                  index={idx}
                  isLoaded={episodesLoaded}
                  episde_id={ep.episode_number}
                  episde_title={ep.name}
                  isSelected={selectedEpisode === ep.episode_number}
                  onSelect={onSelectEpisode}
                />
              ))
            )
        }
      </div>
    </section>
  );
};

export default MovieEpisodes;
