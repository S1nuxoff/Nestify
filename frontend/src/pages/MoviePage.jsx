import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import usePlayerStatus from "../hooks/usePlayerStatus";
import SessionPlaybackControls from "../components/ui/SessionPlaybackControls";

import { getCategories } from "../api/hdrezka";
import { addMovieToHistory } from "../api/user";
import { getMovieSources } from "../api/hdrezka/getMovieStreamUrl";
import { ReactComponent as CastIcon } from "../assets/icons/cast.svg";
import { ReactComponent as BackIcon } from "../assets/icons/back.svg";
import useMovieDetails from "../hooks/useMovieDetails";
import useMovieSource from "../hooks/useMovieSource";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";

import VoiceoverOption from "../components/ui/VoiceoverOption";
import EpisodeSelector from "../components/ui/EpisodeSelector";
import Alert from "../components/ui/Alert";

import "../styles/MoviePage.css";

// ---------- feature-detection для canvas blur ----------
let supportsCanvasBlurCache = null;

function supportsCanvasBlur() {
  if (supportsCanvasBlurCache !== null) return supportsCanvasBlurCache;

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.filter === "undefined") {
      supportsCanvasBlurCache = false;
      return supportsCanvasBlurCache;
    }

    ctx.filter = "blur(10px)";
    supportsCanvasBlurCache = ctx.filter === "blur(10px)";
    return supportsCanvasBlurCache;
  } catch (e) {
    supportsCanvasBlurCache = false;
    return supportsCanvasBlurCache;
  }
}

// простой форматтер времени
function formatTime(sec) {
  const total = Math.floor(sec || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

const MoviePage = () => {
  const { movieLink } = useParams();
  const navigate = useNavigate();

  const decodedLink = movieLink ? decodeURIComponent(movieLink) : null;

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
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  const [validationMessage, setValidationMessage] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  // модалка выбора озвучки
  const [playDialogOpen, setPlayDialogOpen] = useState(false);
  // режим воспроизведения: "browser" | "tv"
  const [playMode, setPlayMode] = useState("browser");

  const { playMovieSource } = useMovieSource();
  const { movieDetails, loading } = useMovieDetails(decodedLink);
  const { status: playerStatus } = usePlayerStatus();

  const backgroundCanvasRef = useRef(null);
  const scrollFactorRef = useRef(0); // 0..1 — насколько затемнять при скролле

  // плавная загрузка постера
  const [posterLoaded, setPosterLoaded] = useState(false);

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
      // якщо юзер вже вибрав сезон руками — не чіпаємо
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

  // reset постера при смене фильма/постера
  useEffect(() => {
    setPosterLoaded(false);
  }, [movieDetails?.image]);

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

  // Canvas-фон из постера + feature detection
  useEffect(() => {
    if (!movieDetails?.image) return;

    if (!supportsCanvasBlur()) {
      return;
    }

    const canvas = backgroundCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    const img = new Image();
    img.src = movieDetails.image;

    const getViewportWidth = () =>
      Math.max(
        document.documentElement.clientWidth || 0,
        window.innerWidth || 0
      );

    const render = () => {
      if (cancelled || !img.complete || !img.naturalWidth) return;

      const cw = (canvas.width = getViewportWidth());
      const ch = (canvas.height =
        window.innerHeight || document.documentElement.clientHeight || 0);

      const BLUR_STRONG = 20;
      const BLUR_SOFT = 1;

      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(cw / iw, ch / ih);
      const w = iw * scale;
      const h = ih * scale;
      const x = (cw - w) / 2;
      const y = (ch - h) / 2;

      const t = scrollFactorRef.current || 0;

      ctx.clearRect(0, 0, cw, ch);

      // 1) сильный blur на всю ширину
      ctx.filter = `blur(${BLUR_STRONG}px)`;
      ctx.drawImage(img, x, y, w, h);
      ctx.filter = "none";

      // 2) offscreen с мягким blur
      const off = document.createElement("canvas");
      off.width = cw;
      off.height = ch;
      const octx = off.getContext("2d");

      octx.filter = `blur(${BLUR_SOFT}px)`;
      octx.drawImage(img, x, y, w, h);
      octx.filter = "none";

      // 3) маска для правой части
      octx.globalCompositeOperation = "destination-in";
      const blurGrad = octx.createLinearGradient(0, 0, cw, 0);
      blurGrad.addColorStop(0.0, "rgba(0,0,0,0)");
      blurGrad.addColorStop(0.3, "rgba(0,0,0,0.2)");
      blurGrad.addColorStop(0.6, "rgba(0,0,0,0.7)");
      blurGrad.addColorStop(1.0, "rgba(0,0,0,1)");
      octx.fillStyle = blurGrad;
      octx.fillRect(0, 0, cw, ch);
      octx.globalCompositeOperation = "source-over";

      ctx.drawImage(off, 0, 0);

      // 4) затемнение справа
      const baseLeft = 0.0;
      const baseMid1 = 0.25;
      const baseMid2 = 0.65;
      const baseRight = 0.9;
      const extra = (v) => Math.min(1, v + 0.4 * t);

      const grad = ctx.createLinearGradient(0, 0, cw, 0);
      grad.addColorStop(0, `rgba(0,0,0,${extra(baseLeft)})`);
      grad.addColorStop(0.4, `rgba(0,0,0,${extra(baseMid1)})`);
      grad.addColorStop(0.75, `rgba(0,0,0,${extra(baseMid2)})`);
      grad.addColorStop(1, `rgba(0,0,0,${extra(baseRight)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);

      // 5) засвет слева
      const glowStrength = 0.24 * (1 - 0.6 * t);
      const radial = ctx.createRadialGradient(
        cw * 0.25,
        ch * 0.4,
        0,
        cw * 0.25,
        ch * 0.4,
        cw * 0.8
      );
      radial.addColorStop(0, `rgba(255,255,255,${glowStrength})`);
      radial.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, cw, ch);

      canvas.classList.add("movie-page__background-canvas--visible");
    };

    const handleScroll = () => {
      const maxScroll = 600;
      const raw = Math.min(window.scrollY / maxScroll, 1);
      const t = 1 - Math.pow(1 - raw, 3); // easeOutCubic
      scrollFactorRef.current = t;
      render();
    };

    const onLoad = () => {
      if (cancelled) return;
      render();
      window.addEventListener("resize", render);
      window.addEventListener("scroll", handleScroll);
    };

    if (img.complete && img.naturalWidth) {
      onLoad();
    } else {
      img.onload = onLoad;
    }

    return () => {
      cancelled = true;
      window.removeEventListener("resize", render);
      window.removeEventListener("scroll", handleScroll);
      canvas.classList.remove("movie-page__background-canvas--visible");
    };
  }, [movieDetails]);

  // чи саме цей фільм зараз грає на Nestify Player
  const isCurrentMovieOnTv =
    !!movieDetails &&
    !!playerStatus &&
    ((movieDetails.id &&
      playerStatus.movie_id &&
      String(movieDetails.id) === String(playerStatus.movie_id)) ||
      (decodedLink &&
        playerStatus.link &&
        decodedLink === playerStatus.link)) &&
    !["stopped", "idle"].includes(
      (playerStatus.state || "").toString().toLowerCase()
    );

  const toggleSeasonDropdown = () => {
    setIsSeasonDropdownOpen((prev) => !prev);
  };
  const [episodesLoaded, setEpisodesLoaded] = useState(false);

  const handleSelectSeason = (seasonNumber) => {
    setSelectedSeason(seasonNumber);
    setSelectedEpisode(null);
    setIsSeasonDropdownOpen(false);
    setEpisodesLoaded(false); // скинь, щоб при новому сезоні знову зіграло
    // episodesLoaded знову стане true завдяки useEffect вище
  };
  useEffect(() => {
    if (!movieDetails?.episodes_schedule || !selectedSeason) return;
    // невелика пауза, щоб DOM намалював список і тоді запустити анімації
    setEpisodesLoaded(false);
    const t = setTimeout(() => setEpisodesLoaded(true), 30);
    return () => clearTimeout(t);
  }, [movieDetails?.episodes_schedule, selectedSeason]);

  // 👉 клик по эпизоду: выбираем и сразу считаем, что хотим смотреть
  const handleSelectEpisode = (episodeNumber) => {
    setSelectedEpisode(episodeNumber);
    setValidationMessage("");
    setPlayDialogOpen(true); // открываем попап выбора озвучки
  };

  const handleBack = () => {
    navigate(-1);
  };

  // ---------- helper: дефолтний S1E1 ----------
  const resolveSeasonEpisode = () => {
    if (!movieDetails) {
      return { season: selectedSeason, episode: selectedEpisode, error: null };
    }

    // якщо це не серіал — нічого не чіпаємо
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

  // ---------- модалка выбора озвучки ----------
  const openPlayDialog = (mode) => {
    if (mode) setPlayMode(mode); // "browser" | "tv"
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

    // 🔥 беремо позицію з тієї серії, на яку ти тикнув (watch_history), а не з last_watch
    let positionSeconds = null;

    if (
      movieDetails &&
      movieDetails.watch_history &&
      Array.isArray(movieDetails.watch_history)
    ) {
      const histories = movieDetails.watch_history.filter((h) => {
        const sameTranslator = String(h.translator_id) === String(translatorId);

        if (movieDetails.action === "get_stream") {
          // серіал — матчимо сезон + епізод + озвучку
          return (
            sameTranslator &&
            h.season === season &&
            h.episode === episode &&
            typeof h.position_seconds === "number" &&
            typeof h.duration === "number" &&
            h.duration > 0
          );
        }

        // фільм — тільки озвучка
        return (
          sameTranslator &&
          typeof h.position_seconds === "number" &&
          typeof h.duration === "number" &&
          h.duration > 0
        );
      });

      if (histories.length > 0) {
        // беремо останній по updated_at / watched_at
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
      link: decodedLink || movieDetails?.link || null,
      originName: movieDetails.origin_name || movieDetails.title,
      title: movieDetails.title,
      image: movieDetails.image,
      userId: currentUser?.id ?? null,
      // нове поле — бекенд має перетворити на &position_seconds=...
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

  // клик по озвучке в попапе — в зависимости от режима playMode
  const handleTranslatorClickInDialog = async (translatorId) => {
    setSelectedTranslatorId(translatorId);
    closePlayDialog();

    if (playMode === "browser") {
      await playInBrowser(translatorId);
    } else if (playMode === "tv") {
      await playOnTv(translatorId);
    }
  };

  // ---------- умный Play (браузер) ----------
  const handleMainPlayClick = async () => {
    if (!movieDetails) return;

    const last = movieDetails.last_watch || null;

    // сериал
    if (movieDetails.action === "get_stream") {
      if (last && last.season && last.episode && last.translator_id) {
        setSelectedSeason(last.season);
        setSelectedEpisode(last.episode);
        setSelectedTranslatorId(last.translator_id);
        await playInBrowser(last.translator_id);
        return;
      }
      // нет истории — открываем попап выбора озвучки
      openPlayDialog("browser");
      return;
    }

    // фильм
    if (last && last.translator_id) {
      setSelectedTranslatorId(last.translator_id);
      await playInBrowser(last.translator_id);
      return;
    }

    // если вообще нет last_watch
    openPlayDialog("browser");
  };

  // ---------- умный Cast ----------
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

  const mainCountry = Array.isArray(movieDetails?.country)
    ? movieDetails.country[0]
    : movieDetails?.country;

  const year = movieDetails?.release_date
    ? movieDetails.release_date.split(",")[0]
    : "";

  const genresText = Array.isArray(movieDetails?.genre)
    ? movieDetails.genre.join(" | ")
    : movieDetails?.genre;

  const playModeLabel =
    playMode === "tv" ? "Nestify Player" : "відтворення в браузері";

  // ---------- прогресс просмотра из last_watch ----------
  const lastWatch = movieDetails?.last_watch || null;
  const lastDurationSec =
    lastWatch && typeof lastWatch.duration === "number"
      ? lastWatch.duration
      : null;
  const lastPositionSec =
    lastWatch && typeof lastWatch.position_seconds === "number"
      ? lastWatch.position_seconds
      : null;

  const hasLastProgress =
    lastDurationSec && lastDurationSec > 0 && lastPositionSec != null;

  const lastPercent = hasLastProgress
    ? Math.min(lastPositionSec / lastDurationSec, 1)
    : null;

  const lastPercentDisplay =
    lastPercent != null ? Math.round(lastPercent * 100) : null;

  const isFullyWatched =
    lastPercent != null && Number.isFinite(lastPercent) && lastPercent >= 0.98;

  const lastEpisodeKey =
    lastWatch && lastWatch.season && lastWatch.episode
      ? `${lastWatch.season}-${lastWatch.episode}`
      : null;

  // ---------- map прогресса по всем сериям ----------
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

  return (
    <div className="container">
      {isCurrentMovieOnTv && (
        <div className="movie-page__tv-session-container">
          <div className="movie-page__tv-session">
            <SessionPlaybackControls />
          </div>
        </div>
      )}

      {movieDetails && (
        <>
          {/* canvas-фон (если поддерживается blur) */}
          <canvas
            ref={backgroundCanvasRef}
            className="movie-page__background-canvas"
          />
          {/* fallback: простой CSS-blur фон, работает везде */}
          <div
            className="movie-page__background-mobile"
            style={{ backgroundImage: `url(${movieDetails.image})` }}
          />
          <div className="movie-page__overlay" />
        </>
      )}

      <Header categories={categories} currentUser={currentUser} />

      <main className="movie-page-main">
        <div className="movie-page-container">
          <div className="category-content-title">
            <BackIcon style={{ cursor: "pointer" }} onClick={handleBack} />
            <span className="row-header-title">Назад</span>
          </div>

          {/* skeleton-хедер при загрузке */}
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

              {/* HEADER */}
              <section className="movie-page__header">
                <div className="movie-page__bg"></div>
                <div className=""></div>
                <div className="movie-page__header-inner">
                  <div className="movie-page__poster-card">
                    <img
                      src={movieDetails.image}
                      alt={movieDetails.title}
                      className={
                        "movie-page__poster-img " +
                        (posterLoaded
                          ? "movie-page__poster-img--loaded"
                          : "movie-page__poster-img--loading")
                      }
                      onLoad={() => setPosterLoaded(true)}
                    />
                  </div>

                  <div className="movie-page__header-details">
                    <div className="movie-page__meta-top">
                      {(year || mainCountry) && (
                        <span className="movie-page__year-country">
                          {year}
                          {year && mainCountry ? ", " : ""}
                          {mainCountry}
                        </span>
                      )}
                    </div>

                    <h1 className="movie-page__title">{movieDetails.title}</h1>

                    <div className="movie-page__chips">
                      <div className="movie-page__chip movie-page__chip-rating">
                        <span className="movie-page__chip-value">
                          {Math.round(movieDetails.rate)}
                        </span>
                        <span className="movie-page__chip-label">TMDB</span>
                      </div>

                      {movieDetails.age !== null && (
                        <div className="movie-page__chip">
                          {movieDetails.age}
                        </div>
                      )}

                      <div className="movie-page__chip movie-page__chip-status">
                        Випущено
                      </div>
                    </div>

                    <div className="movie-page__subinfo">
                      {movieDetails.duration && (
                        <span>{movieDetails.duration}</span>
                      )}
                      {movieDetails.duration && genresText && (
                        <span className="movie-page__dot">•</span>
                      )}
                      {genresText && <span>{genresText}</span>}
                    </div>

                    {/* прогресс просмотра фильма / епізоду */}
                    {lastWatch && hasLastProgress && (
                      <div className="movie-page__progress">
                        <div className="movie-page__progress-top">
                          {movieDetails.action === "get_stream" &&
                          lastWatch.season &&
                          lastWatch.episode ? (
                            <span className="movie-page__progress-label">
                              Продовжити: S{lastWatch.season}E
                              {lastWatch.episode}
                            </span>
                          ) : (
                            <span className="movie-page__progress-label">
                              Продовжити перегляд
                            </span>
                          )}

                          <span className="movie-page__progress-time">
                            {formatTime(lastPositionSec)} /{" "}
                            {formatTime(lastDurationSec)}
                          </span>
                        </div>

                        <div className="movie-page__progress-bar">
                          <div
                            className={
                              "movie-page__progress-bar-inner" +
                              (isFullyWatched
                                ? " movie-page__progress-bar-inner--completed"
                                : "")
                            }
                            style={{
                              width: `${lastPercentDisplay || 0}%`,
                            }}
                          />
                        </div>

                        <span className="movie-page__progress-percent">
                          {isFullyWatched
                            ? "Переглянуто"
                            : `${lastPercentDisplay}%`}
                        </span>
                      </div>
                    )}

                    <div className="movie-page__controls">
                      <div className="movie-page__controls-left">
                        {/* умный Play в браузере */}
                        <div
                          className="movie-page__play-button"
                          onClick={handleMainPlayClick}
                        >
                          ▶ Дивитися
                        </div>

                        {/* Cast → или last_watch, или попап */}
                        <CastIcon
                          className={`movie-page__cast-button${
                            !playerOnline ? " disabled" : ""
                          }`}
                          onClick={
                            playerOnline ? () => handleCastClick() : undefined
                          }
                          title={
                            playerOnline
                              ? "Відправити на Nestify Player"
                              : "Nestify Player офлайн"
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* DETAILS */}
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

                {movieDetails.action === "get_stream" && (
                  <div className="movie-page__episodes">
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
                          {selectedSeason
                            ? `Сезон ${selectedSeason}`
                            : "Оберіть сезон"}
                          <span className="movie-page__season-arrow">▾</span>
                        </div>

                        {isSeasonDropdownOpen && (
                          <div className="movie-page__season-list">
                            {movieDetails.episodes_schedule.map((season) => (
                              <div
                                key={season.season_number}
                                className="movie-page__season-item"
                                onClick={() =>
                                  handleSelectSeason(season.season_number)
                                }
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
                                index={idx} // ← stagger
                                isLoaded={episodesLoaded} // ← тригер анімації
                                episde_date={ep.air_date}
                                episde_id={ep.episode_number}
                                episde_title={ep.title}
                                episde_origin={ep.original_title}
                                isSelected={
                                  selectedEpisode === ep.episode_number
                                }
                                isWatched={epIsWatched}
                                progressPercent={epProgressPercent}
                                onSelect={handleSelectEpisode}
                              />
                            );
                          })
                        )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* МОДАЛКА ВЫБОРА ОЗУЧКИ */}
      {playDialogOpen && movieDetails && (
        <div
          className="movie-page__play-dialog-backdrop"
          onClick={closePlayDialog}
        >
          <div
            className="movie-page__play-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="movie-page__play-dialog-glow" />

            <div className="movie-page__play-dialog-header-row">
              <div className=""></div>
              <button
                className="movie-page__play-dialog-x"
                type="button"
                onClick={closePlayDialog}
              >
                ✕
              </button>
            </div>

            <div className="movie-page__play-dialog-header">
              <h2 className="movie-page__play-dialog-title">
                Виберіть озвучку
              </h2>
              <p className="movie-page__play-dialog-subtitle">
                {movieDetails.title}
              </p>

              {/* инфа про выбранную серию */}
              {movieDetails.action === "get_stream" &&
                (selectedSeason || selectedEpisode) && (
                  <p className="movie-page__play-dialog-episode">
                    {selectedSeason && <>Сезон {selectedSeason}</>}
                    {selectedSeason && selectedEpisode && " · "}
                    {selectedEpisode && <>Серія {selectedEpisode}</>}
                  </p>
                )}

              {/* переключатель режима воспроизведения */}
              <div className="movie-page__play-dialog-modes">
                <button
                  type="button"
                  className={
                    "movie-page__play-dialog-mode-btn" +
                    (playMode === "browser"
                      ? " movie-page__play-dialog-mode-btn--active"
                      : "")
                  }
                  onClick={() => setPlayMode("browser")}
                >
                  В браузері
                </button>
                <button
                  type="button"
                  className={
                    "movie-page__play-dialog-mode-btn" +
                    (playMode === "tv"
                      ? " movie-page__play-dialog-mode-btn--active"
                      : "") +
                    (!playerOnline
                      ? " movie-page__play-dialog-mode-btn--disabled"
                      : "")
                  }
                  onClick={playerOnline ? () => setPlayMode("tv") : undefined}
                >
                  Nestify Player
                </button>
              </div>

              <p className="movie-page__play-dialog-helper">
                Натисніть на бажану доріжку — ми одразу запустимо{" "}
                {playModeLabel}.
              </p>
            </div>

            <div className="movie-page__play-dialog-list">
              {movieDetails.translator_ids.map((translator) => (
                <button
                  key={translator.id}
                  className="movie-page__play-dialog-voice-btn"
                  type="button"
                  onClick={() => handleTranslatorClickInDialog(translator.id)}
                >
                  <VoiceoverOption
                    translator={translator}
                    isSelected={selectedTranslatorId === translator.id}
                    onSelect={() =>
                      handleTranslatorClickInDialog(translator.id)
                    }
                  />
                </button>
              ))}
            </div>

            <div className="movie-page__play-dialog-footer">
              <span className="movie-page__play-dialog-tip">
                Порада: для серіалів за замовчуванням запускається{" "}
                <strong>1 сезон, 1 епізод</strong>, якщо інше не обрано.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoviePage;
