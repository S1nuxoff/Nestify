// src/pages/MoviePage.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import usePlayerStatus from "../hooks/usePlayerStatus";
import SessionPlaybackControls from "../components/ui/SessionPlaybackControls";

import { getCategories } from "../api/hdrezka";
import { addMovieToHistory } from "../api/user";
import { getMovieSources } from "../api/hdrezka/getMovieStreamUrl";
import useMovieDetails from "../hooks/useMovieDetails";
import useMovieSource from "../hooks/useMovieSource";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";
import StickyCategoryHeader from "../components/ui/StickyCategoryHeader";
import Alert from "../components/ui/Alert";

import { fromRezkaSlug } from "../core/rezkaLink";
import config from "../core/config";

import MovieBackground from "../components/movie/MovieBackground";
import MovieHeader from "../components/movie/MovieHeader";
import MovieEpisodes from "../components/movie/MovieEpisodes";
import MoviePlayDialog from "../components/movie/MoviePlayDialog";

import "../styles/MoviePage.css";

const MoviePage = () => {
  const { "*": movieSlug } = useParams(); // все, що після /movie/
  const navigate = useNavigate();

  const slug = movieSlug || null;

  const fullMovieLink = slug
    ? fromRezkaSlug(slug, config.rezka_base_url)
    : null;

  // currentUser из localStorage
  let currentUser = null;
  try {
    const raw = localStorage.getItem("current_user");
    currentUser = raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("bad current_user in localStorage", e);
    currentUser = null;
  }

  const [categories, setCategories] = useState([]);
  const [playerOnline, setPlayerOnline] = useState(
    nestifyPlayerClient.isConnected
  );

  const [selectedTranslatorId, setSelectedTranslatorId] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  const [validationMessage, setValidationMessage] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  const [playDialogOpen, setPlayDialogOpen] = useState(false);
  const [playMode, setPlayMode] = useState("browser"); // "browser" | "tv"

  const { playMovieSource } = useMovieSource();
  const { movieDetails, loading } = useMovieDetails(fullMovieLink);
  const { status: playerStatus } = usePlayerStatus();

  // Категории для Header
  useEffect(() => {
    (async () => {
      try {
        const res = await getCategories();
        setCategories(res.categories || []);
      } catch (e) {
        console.error("getCategories error:", e);
      }
    })();
  }, []);

  // Статус Nestify Player
  useEffect(() => {
    const handler = (status) => setPlayerOnline(status);
    nestifyPlayerClient.on("connected", handler);
    return () => nestifyPlayerClient.off("connected", handler);
  }, []);

  // Пресет сезона / эпизода из last_watch, если есть
  useEffect(() => {
    if (!loading && movieDetails && movieDetails.action === "get_stream") {
      if (selectedSeason !== null) return;

      if (movieDetails.last_watch?.season) {
        setSelectedSeason(movieDetails.last_watch.season);
        if (movieDetails.last_watch.episode) {
          setSelectedEpisode(movieDetails.last_watch.episode);
        }
      } else if (movieDetails?.episodes_schedule?.length > 0) {
        setSelectedSeason(movieDetails.episodes_schedule[0].season_number);
      }
    }
  }, [loading, movieDetails, selectedSeason]);

  // Авто-hide алерта
  useEffect(() => {
    if (validationMessage) {
      setShowValidation(true);
      const timer = setTimeout(() => {
        setShowValidation(false);
        setTimeout(() => setValidationMessage(""), 400);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [validationMessage]);

  // чи саме цей фільм зараз грає на Nestify Player
  const isCurrentMovieOnTv =
    !!movieDetails &&
    !!playerStatus &&
    ((movieDetails.id &&
      playerStatus.movie_id &&
      String(movieDetails.id) === String(playerStatus.movie_id)) ||
      (fullMovieLink &&
        playerStatus.link &&
        fullMovieLink === playerStatus.link)) &&
    !["stopped", "idle"].includes(
      (playerStatus.state || "").toString().toLowerCase()
    );

  const handleBack = () => {
    navigate(-1);
  };

  // ---------- helper: дефолтний S1E1 ----------
  const resolveSeasonEpisode = () => {
    if (!movieDetails) {
      return { season: selectedSeason, episode: selectedEpisode, error: null };
    }

    if (movieDetails.action !== "get_stream") {
      return { season: selectedSeason, episode: selectedEpisode, error: null };
    }

    let season = selectedSeason;
    let episode = selectedEpisode;

    if (season && episode) {
      return { season, episode, error: null };
    }

    const firstSeason = movieDetails.episodes_schedule?.[0];
    const firstEpisode = firstSeason?.episodes?.[0];

    if (!firstSeason || !firstEpisode) {
      return {
        season: null,
        episode: null,
        error: "Не вдалося визначити перший епізод.",
      };
    }

    season = season || firstSeason.season_number;
    episode = episode || firstEpisode.episode_number;

    if (!selectedSeason) setSelectedSeason(firstSeason.season_number);
    if (!selectedEpisode) setSelectedEpisode(firstEpisode.episode_number);

    return { season, episode, error: null };
  };

  const openPlayDialog = (mode) => {
    if (mode) setPlayMode(mode);
    setValidationMessage("");
    setPlayDialogOpen(true);
  };

  const closePlayDialog = () => {
    setPlayDialogOpen(false);
  };

  const playOnTv = async (translatorId) => {
    setValidationMessage("");

    if (!currentUser?.id) {
      setValidationMessage("Потрібен користувач, увійдіть в систему.");
      return;
    }

    if (!playerOnline) {
      setValidationMessage("Nestify Player офлайн");
      return;
    }

    if (!translatorId) {
      setValidationMessage("Будь ласка, виберіть озвучку");
      return;
    }

    const { season, episode, error } = resolveSeasonEpisode();
    if (error) {
      setValidationMessage(error);
      return;
    }

    let positionSeconds = null;

    if (
      movieDetails &&
      movieDetails.watch_history &&
      Array.isArray(movieDetails.watch_history)
    ) {
      const histories = movieDetails.watch_history.filter((h) => {
        const sameTranslator = String(h.translator_id) === String(translatorId);

        if (movieDetails.action === "get_stream") {
          return (
            sameTranslator &&
            h.season === season &&
            h.episode === episode &&
            typeof h.position_seconds === "number" &&
            typeof h.duration === "number" &&
            h.duration > 0
          );
        }

        return (
          sameTranslator &&
          typeof h.position_seconds === "number" &&
          typeof h.duration === "number" &&
          h.duration > 0
        );
      });

      if (histories.length > 0) {
        histories.sort((a, b) => {
          const da = new Date(a.updated_at || a.watched_at || 0).getTime();
          const db = new Date(b.updated_at || b.watched_at || 0).getTime();
          return db - da;
        });

        const best = histories[0];
        const ratio = best.position_seconds / best.duration;
        if (ratio < 0.98) {
          positionSeconds = best.position_seconds;
        }
      }
    }

    const meta = {
      link: fullMovieLink || movieDetails?.link || null,
      originName: movieDetails.origin_name || movieDetails.title,
      title: movieDetails.title,
      image: movieDetails.image,
      userId: currentUser?.id ?? null,
      positionSeconds,
    };

    const success = await playMovieSource({
      seasonId: season,
      episodeId: episode,
      movieId: movieDetails.id,
      translatorId,
      action: movieDetails.action,
      meta,
      positionSeconds,
    });

    if (success) {
      try {
        await addMovieToHistory({
          user_id: currentUser.id,
          season_id: season,
          episode_id: episode,
          movie_id: movieDetails.id,
          translator_id: translatorId,
          action: movieDetails.action,
        });
      } catch (e) {
        console.error("addMovieToHistory error:", e);
      }
    } else {
      setValidationMessage("Не вдалося відправити на Nestify Player.");
    }
  };

  const playInBrowser = async (translatorId) => {
    setValidationMessage("");

    if (!currentUser?.id) {
      setValidationMessage("Потрібен користувач, увійдіть в систему.");
      return;
    }

    if (!translatorId) {
      setValidationMessage("Будь ласка, виберіть озвучку.");
      return;
    }

    const { season, episode, error } = resolveSeasonEpisode();
    if (error) {
      setValidationMessage(error);
      return;
    }

    const sources = await getMovieSources({
      seasonId: season,
      episodeId: episode,
      movieId: movieDetails.id,
      translatorId,
      action: movieDetails.action,
    });

    if (!sources || !sources.length) {
      setValidationMessage("Не вдалося отримати джерела відео.");
      return;
    }

    try {
      await addMovieToHistory({
        user_id: currentUser.id,
        season_id: season,
        episode_id: episode,
        movie_id: movieDetails.id,
        translator_id: translatorId,
        action: movieDetails.action,
      });
    } catch (e) {
      console.error("addMovieToHistory error:", e);
    }

    navigate(`/player/${movieDetails.id}`, {
      state: {
        movieDetails,
        sources,
        selectedEpisode: episode,
        selectedSeason: season,
      },
    });
  };

  const handleTranslatorClickInDialog = async (translatorId) => {
    setSelectedTranslatorId(translatorId);
    closePlayDialog();

    if (playMode === "browser") {
      await playInBrowser(translatorId);
    } else if (playMode === "tv") {
      await playOnTv(translatorId);
    }
  };

  // умный Play (браузер)
  const handleMainPlayClick = async () => {
    if (!movieDetails) return;

    const last = movieDetails.last_watch || null;

    if (movieDetails.action === "get_stream") {
      if (last && last.season && last.episode && last.translator_id) {
        setSelectedSeason(last.season);
        setSelectedEpisode(last.episode);
        setSelectedTranslatorId(last.translator_id);
        await playInBrowser(last.translator_id);
        return;
      }
      openPlayDialog("browser");
      return;
    }

    if (last && last.translator_id) {
      setSelectedTranslatorId(last.translator_id);
      await playInBrowser(last.translator_id);
      return;
    }

    openPlayDialog("browser");
  };

  // умный Cast
  const handleCastClick = async () => {
    if (!playerOnline || !movieDetails) return;

    const last = movieDetails.last_watch || null;

    if (movieDetails.action === "get_stream") {
      if (last && last.season && last.episode && last.translator_id) {
        setSelectedSeason(last.season);
        setSelectedEpisode(last.episode);
        setSelectedTranslatorId(last.translator_id);
        await playOnTv(last.translator_id);
        return;
      }
      openPlayDialog("tv");
      return;
    }

    if (last && last.translator_id) {
      setSelectedTranslatorId(last.translator_id);
      await playOnTv(last.translator_id);
      return;
    }

    openPlayDialog("tv");
  };

  // обработчики выбора сезона / серии
  const handleSelectSeason = (seasonNumber) => {
    setSelectedSeason(seasonNumber);
    setSelectedEpisode(null);
  };

  const handleSelectEpisode = (episodeNumber) => {
    setSelectedEpisode(episodeNumber);
    setValidationMessage("");
    setPlayDialogOpen(true);
  };

  return (
    <div className="container">
      {isCurrentMovieOnTv && (
        <div className="movie-page__tv-session-container">
          <div className="movie-page__tv-session">
            <SessionPlaybackControls />
          </div>
        </div>
      )}

      <MovieBackground image={movieDetails?.image} />

      <Header categories={categories} currentUser={currentUser} />

      <main className="movie-page-main">
        <div className="movie-page-container">
          <StickyCategoryHeader title="Назад" onBack={handleBack} />

          {loading && (
            <section className="movie-page__header movie-page__header-skeleton">
              <div className="movie-page__header-inner">
                <div className="movie-page__poster-card movie-page__poster-skeleton skeleton-block" />

                <div className="movie-page__header-details">
                  <div className="movie-page__skeleton-line skeleton-block skeleton-line-sm" />
                  <div className="movie-page__skeleton-line skeleton-block skeleton-line-lg" />
                  <div className="movie-page__skeleton-line skeleton-block skeleton-line-md" />

                  <div className="movie-page__skeleton-chips">
                    <div className="skeleton-block skeleton-chip" />
                    <div className="skeleton-block skeleton-chip" />
                    <div className="skeleton-block skeleton-chip" />
                  </div>

                  <div className="movie-page__skeleton-subinfo">
                    <div className="skeleton-block skeleton-pill" />
                    <div className="skeleton-block skeleton-pill" />
                  </div>

                  <div className="movie-page__skeleton-controls">
                    <div className="skeleton-block skeleton-btn" />
                    <div className="skeleton-block skeleton-circle" />
                  </div>
                </div>
              </div>
            </section>
          )}

          {!loading && !movieDetails && (
            <div className="movie-page__error">
              Не вдалося завантажити інформацію про фільм.
            </div>
          )}

          {!loading && movieDetails && (
            <div className="movie-page movie-page--loaded">
              {validationMessage && (
                <Alert
                  visible={!!validationMessage}
                  type="error"
                  title="Ooops.."
                  message={validationMessage}
                />
              )}

              <MovieHeader
                movieDetails={movieDetails}
                playerOnline={playerOnline}
                onMainPlayClick={handleMainPlayClick}
                onCastClick={handleCastClick}
              />

              <section className="movie-page__details">
                <span className="row-header-title">Детально</span>

                <div className="movie-page__description-wrap">
                  <p className="movie-page__description">
                    {movieDetails.description}
                  </p>

                  <div className="movie-page__infotable">
                    <div className="movie-page__infotable-row">
                      <span className="movie-page__infotable-label">Жанр:</span>
                      {Array.isArray(movieDetails.genre) ? (
                        movieDetails.genre.map((g, idx) => (
                          <span
                            key={idx}
                            className="movie-page__infotable-value"
                          >
                            {g}
                            {idx < movieDetails.genre.length - 1 ? ", " : ""}
                          </span>
                        ))
                      ) : (
                        <span className="movie-page__infotable-value">
                          {movieDetails.genre}
                        </span>
                      )}
                    </div>

                    <div className="movie-page__infotable-row">
                      <span className="movie-page__infotable-label">
                        Країна:
                      </span>
                      {Array.isArray(movieDetails.country) ? (
                        movieDetails.country.map((c, idx) => (
                          <span
                            key={idx}
                            className="movie-page__infotable-value"
                          >
                            {c}
                            {idx < movieDetails.country.length - 1 ? ", " : ""}
                          </span>
                        ))
                      ) : (
                        <span className="movie-page__infotable-value">
                          {movieDetails.country}
                        </span>
                      )}
                    </div>

                    <div className="movie-page__infotable-row">
                      <span className="movie-page__infotable-label">
                        Режисер:
                      </span>
                      {Array.isArray(movieDetails.director) ? (
                        movieDetails.director.map((d, idx) => (
                          <span
                            key={idx}
                            className="movie-page__infotable-value"
                          >
                            {d}
                            {idx < movieDetails.director.length - 1 ? ", " : ""}
                          </span>
                        ))
                      ) : (
                        <span className="movie-page__infotable-value">
                          {movieDetails.director}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <MovieEpisodes
                movieDetails={movieDetails}
                selectedSeason={selectedSeason}
                onSelectSeason={handleSelectSeason}
                selectedEpisode={selectedEpisode}
                onSelectEpisode={handleSelectEpisode}
              />
            </div>
          )}
        </div>
      </main>

      <Footer />

      <MoviePlayDialog
        open={playDialogOpen}
        movieDetails={movieDetails}
        playMode={playMode}
        onChangePlayMode={setPlayMode}
        playerOnline={playerOnline}
        selectedSeason={selectedSeason}
        selectedEpisode={selectedEpisode}
        selectedTranslatorId={selectedTranslatorId}
        onClose={closePlayDialog}
        onTranslatorClick={handleTranslatorClickInDialog}
      />
    </div>
  );
};

export default MoviePage;
