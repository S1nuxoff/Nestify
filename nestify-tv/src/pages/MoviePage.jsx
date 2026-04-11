// src/pages/MoviePage.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { playWithAndroidBridgeOrFallback } from "../api/AndroidBridge";
import usePlayerStatus from "../hooks/usePlayerStatus";
import SessionPlaybackControls from "../components/ui/SessionPlaybackControls";

import { getCategories } from "../api/hdrezka";
import {
  addLikedMovie,
  addMovieToHistory,
  getLikedMovieStatus,
  removeLikedMovie,
} from "../api/user";
import { getMovieSources } from "../api/hdrezka/getMovieStreamUrl";
import useMovieDetails from "../hooks/useMovieDetails";
import useMovieSource from "../hooks/useMovieSource";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";
import Alert from "../components/ui/Alert";

import { fromRezkaSlug } from "../core/rezkaLink";
import { getCurrentProfile } from "../core/session";
import config from "../core/config";
import { useTvDevice } from "../hooks/useTvDevice";

import MovieHeader from "../components/movie/MovieHeader";
import MovieEpisodes from "../components/movie/MovieEpisodes";
import MoviePlayDialog from "../components/movie/MoviePlayDialog";
import MovieCast from "../components/movie/MovieCast";

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
  const [selectedTranslatorId, setSelectedTranslatorId] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  const [validationMessage, setValidationMessage] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  const [playDialogOpen, setPlayDialogOpen] = useState(false);
  const [playMode, setPlayMode] = useState("browser"); // "browser" | "tv"
  const [isLiked, setIsLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);

  // Tabs: default episodes
  const [activeTab, setActiveTab] = useState("episodes"); // "episodes" | "details"

  const { playMovieSource } = useMovieSource();
  const { movieDetails, loading } = useMovieDetails(fullMovieLink);
  const { status: playerStatus } = usePlayerStatus();
  const { device: tvDevice } = useTvDevice();
  const playerOnline = !!tvDevice;

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

  const ensureTvConnected = async () => {
    if (!tvDevice) return false;

    const profile = getCurrentProfile();
    nestifyPlayerClient.setProfileName(profile?.name || "");
    nestifyPlayerClient.setAvatarUrl(
      profile?.avatar_url ? `${config.backend_url}${profile.avatar_url}` : ""
    );
    nestifyPlayerClient.setUserId(profile?.id || "");

    if (nestifyPlayerClient.deviceId !== tvDevice.device_id) {
      nestifyPlayerClient.setDeviceId(tvDevice.device_id);
    }

    if (nestifyPlayerClient.isConnected) {
      return true;
    }

    return await new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        nestifyPlayerClient.off("connected", onConnected);
        clearTimeout(timer);
      };

      const finish = (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const onConnected = (connected) => {
        if (connected) finish(true);
      };

      const timer = setTimeout(() => finish(false), 4000);

      nestifyPlayerClient.on("connected", onConnected);
      nestifyPlayerClient.setDeviceId(tvDevice.device_id);
    });
  };

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

  // Episodes exist?
  const hasEpisodes =
    !!movieDetails &&
    movieDetails.action === "get_stream" &&
    Array.isArray(movieDetails.episodes_schedule) &&
    movieDetails.episodes_schedule.length > 0 &&
    Array.isArray(movieDetails.episodes_schedule[0]?.episodes) &&
    movieDetails.episodes_schedule[0].episodes.length > 0;

  // Автовибір таба: якщо серій нема — "Деталі", якщо є — дефолт "Серії"
  useEffect(() => {
    if (!movieDetails) return;

    if (!hasEpisodes) {
      setActiveTab("details");
    } else {
      // не перебивати вручну обрані "Деталі"
      setActiveTab((prev) => (prev === "details" ? "details" : "episodes"));
    }
  }, [movieDetails, hasEpisodes]);

  useEffect(() => {
    if (!currentUser?.id || !fullMovieLink) {
      setIsLiked(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await getLikedMovieStatus({
          user_id: currentUser.id,
          link: fullMovieLink,
        });
        if (!cancelled) setIsLiked(Boolean(result?.liked));
      } catch (e) {
        if (!cancelled) console.error("getLikedMovieStatus error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, fullMovieLink]);

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

  const toggleLike = async () => {
    if (!currentUser?.id || !movieDetails || !fullMovieLink || likePending) return;

    const nextLiked = !isLiked;
    setLikePending(true);
    setIsLiked(nextLiked);

    try {
      if (nextLiked) {
        await addLikedMovie({
          user_id: currentUser.id,
          movie_id: movieDetails.id,
          tmdb_id: movieDetails.tmdb?.id ? String(movieDetails.tmdb.id) : null,
          tmdb_type: movieDetails.tmdb?.type || null,
          link: fullMovieLink,
          title: movieDetails.title,
          origin_name: movieDetails.origin_name,
          tmdb_title: movieDetails.tmdb?.title || movieDetails.tmdb?.original_title || null,
          image: movieDetails.poster_tmdb || movieDetails.image,
          poster: movieDetails.poster_tmdb || movieDetails.image,
          backdrop: movieDetails.backdrop || movieDetails.backdrop_url || movieDetails.backdrop_url_original || null,
          description: movieDetails.description,
          overview: movieDetails.tmdb?.overview || movieDetails.description || null,
          short_desc: movieDetails.description,
          release_date: movieDetails.release_date,
          action: movieDetails.action,
          type: movieDetails.tmdb?.type || null,
          year: movieDetails.release_date
            ? Number(String(movieDetails.release_date).split(",")[0]) || null
            : null,
          rating: movieDetails.rate || null,
        });
      } else {
        await removeLikedMovie({ user_id: currentUser.id, link: fullMovieLink });
      }
    } catch (e) {
      setIsLiked(!nextLiked);
      console.error("toggleLike error:", e);
    } finally {
      setLikePending(false);
    }
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

    const profile = getCurrentProfile();
    if (tvDevice?.device_id) {
      nestifyPlayerClient.setDeviceId(tvDevice.device_id);
    }
    nestifyPlayerClient.setProfileName(profile?.name || "");
    nestifyPlayerClient.setAvatarUrl(
      profile?.avatar_url ? `${config.backend_url}${profile.avatar_url}` : ""
    );
    nestifyPlayerClient.setUserId(profile?.id || "");

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

    const result = await getMovieSources({
      seasonId: season,
      episodeId: episode,
      movieId: movieDetails.id,
      translatorId,
      action: movieDetails.action,
    });

    const sources = result?.sources || [];
    const subtitles = result?.subtitles || [];

    if (!sources.length) {
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

    const preferredSource = sources[sources.length - 1] || sources[0];

    playWithAndroidBridgeOrFallback({
      url: preferredSource?.url || "",
      title: movieDetails?.title || "",
      posterUrl: movieDetails?.poster || movieDetails?.poster_url || "",
      mediaType: movieDetails?.type || "movie",
      tmdbId: movieDetails?.tmdb_id || movieDetails?.id || "",
      movieId: movieDetails?.id || "",
      userId: currentUser?.id || "",
      season,
      episode,
      fallback: () => {
        navigate(`/player/${movieDetails.id}`, {
          state: {
            movieDetails,
            sources,
            subtitles,
            selectedEpisode: episode,
            selectedSeason: season,
          },
        });
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
    if (!tvDevice || !movieDetails) return;

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
    setActiveTab("episodes");
  };

  const handleSelectEpisode = (episodeNumber) => {
    setSelectedEpisode(episodeNumber);
    setValidationMessage("");
    setActiveTab("episodes");
    setPlayDialogOpen(true);
  };

  return (
    <div className="">
      {isCurrentMovieOnTv && (
        // MoviePage.jsx (там где контейнер)
        <div className="movie-page__tv-session-container">
          <div className="movie-page__tv-session">
            <SessionPlaybackControls />
          </div>
        </div>
      )}

      <Header
        // showMenu={false}
        categories={categories}
        currentUser={currentUser}
      />

      <main className="movie-page-main">
        <div className="movie-page-container">
          {loading && (
            <div className="container">
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
            </div>
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
                isLiked={isLiked}
                likePending={likePending}
                onToggleLike={toggleLike}
                onMainPlayClick={handleMainPlayClick}
                onCastClick={tvDevice ? handleCastClick : null}
              />

              <div className="container">
                {/* Tabs */}
                <div className="movie-page__tabs">
                  {hasEpisodes && (
                    <button
                      className={`movie-page__tab ${
                        activeTab === "episodes" ? "is-active" : ""
                      }`}
                      onClick={() => setActiveTab("episodes")}
                      type="button"
                    >
                      Епізоди
                    </button>
                  )}

                  <button
                    className={`movie-page__tab ${
                      activeTab === "details" ? "is-active" : ""
                    }`}
                    onClick={() => setActiveTab("details")}
                    type="button"
                  >
                    Детально
                  </button>
                </div>

                {/* Details */}
                {activeTab === "details" && (
                  <section className="movie-page__details">
                    <span className="row-header-title">Детально</span>

                    <div className="movie-page__description-wrap">
                      <p className="movie-page__description">
                        {movieDetails.description}
                      </p>

                      <div className="movie-page__infotable">
                        <div className="movie-page__infotable-row">
                          <span className="movie-page__infotable-label">
                            Жанр:
                          </span>
                          {Array.isArray(movieDetails.genre) ? (
                            movieDetails.genre.map((g, idx) => (
                              <span
                                key={idx}
                                className="movie-page__infotable-value"
                              >
                                {g}
                                {idx < movieDetails.genre.length - 1
                                  ? ", "
                                  : ""}
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
                                {idx < movieDetails.country.length - 1
                                  ? ", "
                                  : ""}
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
                                {idx < movieDetails.director.length - 1
                                  ? ", "
                                  : ""}
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

                    <MovieCast actors={movieDetails.actors} />
                  </section>
                )}

                {/* Episodes */}
                {activeTab === "episodes" && hasEpisodes && (
                  <MovieEpisodes
                    movieDetails={movieDetails}
                    selectedSeason={selectedSeason}
                    onSelectSeason={handleSelectSeason}
                    selectedEpisode={selectedEpisode}
                    onSelectEpisode={handleSelectEpisode}
                  />
                )}

                {/* If episodes tab selected but no episodes */}
                {activeTab === "episodes" && !hasEpisodes && (
                  <section className="movie-page__details">
                    <span className="row-header-title">Детально</span>
                    <p className="movie-page__description">
                      Для цього тайтлу немає епізодів. Перейдіть у “Деталі”.
                    </p>
                  </section>
                )}
              </div>
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
