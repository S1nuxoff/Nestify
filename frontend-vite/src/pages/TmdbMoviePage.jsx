import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCollectionDetails, getMovieDetails, getTvDetails, getTvSeason, getRecommendations, normalizeTmdbItem, pickTmdbLogo, tmdbImg, tmdbImgOriginal, getTitleInEnglish, getTitleInPolish, getReviews } from "../api/tmdb";
import ContentRowSwiper from "../components/section/ContentRowSwiper";
import MediaCard from "../components/ui/MediaCard";
import Header from "../components/layout/Header";
import MovieHeader from "../components/movie/MovieHeader";
import MovieCast from "../components/movie/MovieCast";
import MovieEpisodes from "../components/movie/MovieEpisodes";
import TorrentModal from "../components/ui/TorrentModal";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";
import config from "../core/config";
import { addLikedMovie, removeLikedMovie, getLikedMovieStatus } from "../api/user";
import { getProgress } from "../api/hdrezka/progressApi";
import { addTorrent, getTorrentStatus, startHlsSession } from "../api/v3";
import { getCurrentProfile } from "../core/session";
import { useTvDevice } from "../hooks/useTvDevice";
import "../styles/MoviePage.css";
import "../styles/TorrentModal.css";

const VIDEO_TYPE_PRIORITY = {
  Trailer: 0,
  Teaser: 1,
  Clip: 2,
  Featurette: 3,
  "Behind the Scenes": 4,
  "Opening Credits": 5,
  Recap: 6,
};

const InfoCard = ({ label, value }) => (
  <div className="flex min-h-[72px] flex-col justify-between border-b border-white/[0.04] py-3">
    <span className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
      {label}
    </span>
    <span className="text-[14px] font-semibold leading-[1.4] text-white/70 md:text-[15px]">
      {value}
    </span>
  </div>
);

const VideoCard = ({ video, onOpen }) => (
  <button
    className="flex w-[70vw] min-w-[70vw] shrink-0 cursor-pointer flex-col gap-3 border-0 bg-transparent p-0 text-left text-inherit md:w-[300px] md:min-w-[300px]"
    type="button"
    onClick={() => onOpen(video)}
  >
    <div className="relative aspect-[1.72/1] overflow-hidden rounded-[14px] bg-white/5">
      <img
        className="block h-full w-full object-cover transition duration-300 ease-out hover:scale-[1.04] hover:opacity-90"
        src={`https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`}
        alt={video.name}
        loading="lazy"
      />
    </div>
    <span className="line-clamp-2 text-[13px] font-medium leading-[1.4] text-white md:text-[14px]">
      {video.name}
    </span>
    <span className="text-[11px] leading-[1.4] text-white/50 md:text-[12px]" style={{marginTop: -4}}>
      {video.official ? "Official" : "Video"}
      {video.publishedAtLabel ? ` • ${video.publishedAtLabel}` : ""}
    </span>
  </button>
);

const VideoModal = ({ video, onClose }) => {
  if (!video) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#050505]/85 p-3 backdrop-blur md:p-6"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[1100px] overflow-hidden rounded-[18px] border border-white/10 bg-[#0f0f10] shadow-[0_24px_100px_rgba(0,0,0,0.5)] md:rounded-[24px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-4 pt-4 md:px-5 md:pt-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">
              {video.typeLabel}
            </div>
            <h3 className="mt-1.5 text-[17px] leading-[1.3] text-white md:text-[20px]">
              {video.name}
            </h3>
          </div>
          <button
            className="h-10 w-10 shrink-0 rounded-full border-0 bg-white/10 text-[28px] leading-none text-white"
            type="button"
            onClick={onClose}
            aria-label="Закрити"
          >
            ×
          </button>
        </div>

        <div className="relative mt-[18px] aspect-video bg-black">
          <iframe
            className="h-full w-full border-0"
            src={`https://www.youtube.com/embed/${video.key}?autoplay=1&rel=0`}
            title={video.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};

function formatPublishedAt(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("uk-UA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function buildVideoGallery(videos) {
  const all = (videos || []).filter((video) => video?.site === "YouTube" && video?.key);
  const prioritized = all.filter((video) => Object.hasOwn(VIDEO_TYPE_PRIORITY, video.type));
  const source = prioritized.length > 0 ? prioritized : all;

  return source
    .sort((a, b) => {
      const pa = VIDEO_TYPE_PRIORITY[a.type] ?? 99;
      const pb = VIDEO_TYPE_PRIORITY[b.type] ?? 99;
      if (pa !== pb) return pa - pb;
      if (Boolean(a.official) !== Boolean(b.official)) return a.official ? -1 : 1;
      return new Date(b.published_at || 0) - new Date(a.published_at || 0);
    })
    .filter((video, index, list) => list.findIndex((item) => item.key === video.key) === index)
    .slice(0, 8)
    .map((video) => ({
      ...video,
      typeLabel: video.type,
      publishedAtLabel: formatPublishedAt(video.published_at),
    }));
}

// Перетворення TMDB даних у формат, який очікує MovieHeader
function buildMovieDetails(details, mediaType) {
  if (!details) return null;

  const title = details.title || details.name || "";
  const originName = details.original_title || details.original_name || "";
  const releaseDate = (details.release_date || details.first_air_date || "").slice(0, 4);
  const runtime = details.runtime
    ? `${Math.floor(details.runtime / 60)}г ${details.runtime % 60}хв`
    : null;
  const genres = (details.genres || []).map((g) => g.name);
  const logoUrl = pickTmdbLogo(details.images?.logos || []);

  // Трейлер з TMDB videos
  const trailer = (details.videos?.results || []).find(
    (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
  );
  const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : "";

  // Актори у форматі MovieCast
  const actors = (details.credits?.cast || []).slice(0, 24).map((a) => ({
    id: a.id,
    personId: a.id,
    name: a.name,
    photo: tmdbImg(a.profile_path, "w185"),
    job: a.character,
    url: null,
  }));

  const directors = (details.credits?.crew || [])
    .filter((person) =>
      mediaType === "tv"
        ? person.job === "Director" || person.job === "Executive Producer"
        : person.job === "Director"
    )
    .slice(0, mediaType === "tv" ? 6 : 3)
    .map((person) => ({
      id: person.id,
      personId: person.id,
      name: person.name,
      photo: tmdbImg(person.profile_path, "w185"),
      job: person.job,
      url: null,
    }));

  // Сезони у форматі MovieEpisodes (для серіалів)
  const episodesSchedule = mediaType === "tv"
    ? (details.seasons || [])
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          season_number: s.season_number,
          episodes: Array.from({ length: s.episode_count || 0 }, (_, i) => ({
            episode_number: i + 1,
            name: `Епізод ${i + 1}`,
          })),
        }))
    : [];

  const directorNames = (details.credits?.crew || [])
    .filter((p) => p.job === "Director")
    .slice(0, 2)
    .map((p) => p.name);

  const studios = (details.production_companies || [])
    .slice(0, 2)
    .map((c) => c.name);

  return {
    id: `tmdb_${mediaType}_${details.id}`,
    tmdb_id: String(details.id),
    tmdb_type: mediaType,
    title,
    origin_name: originName !== title ? originName : null,
    description: details.overview || "",
    rate: details.vote_average ? details.vote_average.toFixed(1) : null,
    release_date: releaseDate,
    duration: runtime,
    runtime: details.runtime || 0,
    genre: genres,
    age: details.adult ? "18+" : null,
    image: tmdbImg(details.poster_path, "w342"),
    poster_tmdb: tmdbImg(details.poster_path, "w342"),
    backdrop: tmdbImgOriginal(details.backdrop_path),
    backdrop_url_original: tmdbImgOriginal(details.backdrop_path),
    logo_url: logoUrl,
    trailer_tmdb: trailerUrl,
    action: mediaType === "tv" ? "get_stream" : "get_movie",
    directors,
    director_names: directorNames,
    studios,
    actors,
    episodes_schedule: episodesSchedule,
    last_watch: null,
    watch_history: [],
  };
}

export default function TmdbMoviePage() {
  const { mediaType, tmdbId } = useParams();
  const navigate = useNavigate();

  const [rawDetails, setRawDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [torrentOpen, setTorrentOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [collectionItems, setCollectionItems] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [titleEnglish, setTitleEnglish] = useState(null);
  const [titlePolish, setTitlePolish] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  let currentUser = null;
  try {
    const raw = localStorage.getItem("current_user");
    currentUser = raw ? JSON.parse(raw) : null;
  } catch {}

  const movieDetails = useMemo(
    () => buildMovieDetails(rawDetails, mediaType),
    [rawDetails, mediaType]
  );
  const galleryVideos = useMemo(
    () => buildVideoGallery(rawDetails?.videos?.results),
    [rawDetails?.videos?.results]
  );

  const [reviews, setReviews] = useState([]);
  const { device: tvDevice } = useTvDevice();
  const playerOnline = !!tvDevice;

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

  useEffect(() => {
    if (!activeVideo) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setActiveVideo(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeVideo]);

  useEffect(() => {
    if (!tmdbId) return;
    setLoading(true);
    const fetchDetails = mediaType === "tv" ? getTvDetails : getMovieDetails;
    fetchDetails(tmdbId)
      .then(data => {
        setRawDetails(data);
        // Якщо оригінальна назва не латинська (китайська/японська/корейська тощо) — фетчимо англійську
        const origTitle = data?.original_title || data?.original_name || "";
        const isNonLatin = /[^\u0000-\u024F\u0400-\u04FF\s\d]/.test(origTitle);
        if (isNonLatin) {
          getTitleInEnglish(tmdbId, mediaType).then(setTitleEnglish).catch(() => {});
        } else {
          setTitleEnglish(null);
        }
        getTitleInPolish(tmdbId, mediaType).then(setTitlePolish).catch(() => {});
      })
      .catch(() => setRawDetails(null))
      .finally(() => setLoading(false));

    getReviews(tmdbId, mediaType).then(data => {
      setReviews(data);
    }).catch(() => {});

    getRecommendations(tmdbId, mediaType)
      .then((items) =>
        setRecommendations(
          items.map((i) => normalizeTmdbItem({ ...i, media_type: mediaType }))
        )
      )
      .catch(() => {});

  }, [tmdbId, mediaType]);

  useEffect(() => {
    if (mediaType !== "movie" || !rawDetails?.belongs_to_collection?.id) {
      setCollectionItems([]);
      return;
    }

    getCollectionDetails(rawDetails.belongs_to_collection.id)
      .then((collection) => {
        const parts = (collection?.parts || [])
          .filter((item) => String(item.id) !== String(tmdbId))
          .sort(
            (a, b) =>
              new Date(a.release_date || 0) - new Date(b.release_date || 0)
          )
          .map((item) =>
            normalizeTmdbItem({ ...item, media_type: "movie" })
          );

        setCollectionItems(parts);
      })
      .catch(() => setCollectionItems([]));
  }, [mediaType, rawDetails?.belongs_to_collection?.id, tmdbId]);

  // Авто-вибір таба
  useEffect(() => {
    if (!movieDetails) return;
    const hasEpisodes =
      mediaType === "tv" &&
      Array.isArray(movieDetails.episodes_schedule) &&
      movieDetails.episodes_schedule.length > 0;

    if (hasEpisodes) {
      if (!selectedSeason && movieDetails.episodes_schedule[0]) {
        setSelectedSeason(movieDetails.episodes_schedule[0].season_number);
      }
    }
  }, [movieDetails, mediaType]);

  useEffect(() => {
    if (!selectedSeason || mediaType !== "tv" || !tmdbId) return;
    setSeasonEpisodes([]);
    setSeasonLoading(true);
    getTvSeason(tmdbId, selectedSeason)
      .then((data) => setSeasonEpisodes(data.episodes || []))
      .catch(() => setSeasonEpisodes([]))
      .finally(() => setSeasonLoading(false));
  }, [tmdbId, selectedSeason, mediaType]);


  useEffect(() => {
    if (!currentUser?.id || !tmdbId) return;
    getLikedMovieStatus({
      user_id: currentUser.id,
      link: `tmdb:${mediaType}:${tmdbId}`,
    })
      .then((r) => setIsLiked(Boolean(r?.liked)))
      .catch(() => {});
  }, [currentUser?.id, tmdbId, mediaType]);

  const toggleLike = async () => {
    if (!currentUser?.id || !movieDetails || likePending) return;
    const next = !isLiked;
    setLikePending(true);
    setIsLiked(next);
    try {
      if (next) {
        await addLikedMovie({
          user_id: currentUser.id,
          link: `tmdb:${mediaType}:${tmdbId}`,
          title: movieDetails.title,
          origin_name: movieDetails.origin_name,
          image: movieDetails.poster_tmdb,
          poster: movieDetails.poster_tmdb,
          backdrop: movieDetails.backdrop_url_original,
          description: movieDetails.description,
          overview: movieDetails.description,
          release_date: movieDetails.release_date,
          type: mediaType,
          tmdb_id: tmdbId,
          tmdb_type: mediaType,
        });
      } else {
        await removeLikedMovie({
          user_id: currentUser.id,
          link: `tmdb:${mediaType}:${tmdbId}`,
        });
      }
    } catch {
      setIsLiked(!next);
    } finally {
      setLikePending(false);
    }
  };


  const handlePlayInBrowser = (file, durationSeconds = null, hlsInfo = null, hlsPlaylistUrl = null) => {
    const streamUrl = hlsPlaylistUrl || file.stream_url;
    navigate(`/player/tmdb_${mediaType}_${tmdbId}`, {
      state: {
        movieDetails,
        sources: [{ quality: "auto", url: streamUrl }],
        movie_url: streamUrl,
        subtitles: [],
        fileDuration: durationSeconds,
        hlsInfo,
      },
    });
  };

  const handleSendToTv = async (file) => {
    if (!tvDevice || !movieDetails) return;
    let streamUrl = file.stream_url;
    try {
      const parsed = new URL(streamUrl);
      const base = new URL(config.backend_url);
      parsed.protocol = base.protocol;
      parsed.host = base.host;
      parsed.searchParams.delete("transcode");
      streamUrl = parsed.toString();
    } catch {}
    console.log("[handleSendToTv] streamUrl:", streamUrl);
    nestifyPlayerClient.setDeviceId(tvDevice.device_id);
    nestifyPlayerClient.setProfileName(getCurrentProfile()?.name || "");
    nestifyPlayerClient.setAvatarUrl(
      getCurrentProfile()?.avatar_url
        ? `${config.backend_url}${getCurrentProfile().avatar_url}`
        : ""
    );
    nestifyPlayerClient.setUserId(getCurrentProfile()?.id || "");
    await nestifyPlayerClient.playOnTv({
      streamUrl,
      title: movieDetails.title,
      image: movieDetails.poster_tmdb || "",
      movieId: `tmdb_${mediaType}_${tmdbId}`,
    });
  };

  const hasEpisodes =
    mediaType === "tv" &&
    Array.isArray(movieDetails?.episodes_schedule) &&
    movieDetails.episodes_schedule.length > 0 &&
    movieDetails.episodes_schedule[0]?.episodes?.length > 0;

  const handleRecommendationSelect = (movie) => {
    navigate(`/title/${movie.mediaType || "movie"}/${movie.tmdbId}`);
  };

  const year = movieDetails?.release_date || "";
  const title = movieDetails?.title || "";
  const titleOriginal = rawDetails?.original_title || rawDetails?.original_name || title;

  return (
    <div>
      <Header currentUser={currentUser || {}} />

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
              <MovieHeader
                movieDetails={movieDetails}
                tagline={rawDetails?.tagline || ""}
                playerOnline={playerOnline}
                isLiked={isLiked}
                likePending={likePending}
                onToggleLike={toggleLike}
                onMainPlayClick={() => setTorrentOpen(true)}
                onCastClick={tvDevice ? () => setTorrentOpen(true) : null}
              />

              <div className="container">
                <section className="movie-page__details">

                  {/* 1. Опис */}
                  {movieDetails.description && (
                    <div className={`movie-page__desc-wrap${!descExpanded && movieDetails.description.length > 200 ? " movie-page__desc-wrap--clamped" : ""}`}>
                      <p className={`movie-page__description movie-page__description--gray${!descExpanded ? " movie-page__description--clamp" : ""}`}>
                        {movieDetails.description}
                      </p>
                      {movieDetails.description.length > 200 && (
                        <button
                          className={`movie-page__desc-more${descExpanded ? " movie-page__desc-less" : ""}`}
                          onClick={() => setDescExpanded(v => !v)}
                          type="button"
                        >
                          {descExpanded ? "менше" : "більше"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 2. Трейлери */}
                  {galleryVideos.length > 0 && (
                    <section className="mt-7">
                      <div className="mb-4">
                        <h2 className="movie-section-title">
                          Кліпи та трейлери
                        </h2>
                      </div>
                      <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {galleryVideos.map((video) => (
                          <VideoCard
                            key={video.id || video.key}
                            video={video}
                            onOpen={setActiveVideo}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 3. Серії */}
                  {hasEpisodes && (
                    <MovieEpisodes
                      movieDetails={movieDetails}
                      selectedSeason={selectedSeason}
                      onSelectSeason={(s) => { setSelectedSeason(s); setSelectedEpisode(null); }}
                      selectedEpisode={selectedEpisode}
                      onSelectEpisode={(e) => { setSelectedEpisode(e); setTorrentOpen(true); }}
                      seasonEpisodes={seasonEpisodes}
                      seasonLoading={seasonLoading}
                    />
                  )}

                  {/* 4. Відгуки */}
                  {(reviews.length > 0 || movieDetails.rate) && (
                    <section style={{ marginTop: 32, marginBottom: 8 }}>
                      <h2 className="movie-section-title" style={{ marginBottom: 16 }}>
                        Рейтинг та відгуки
                      </h2>

                      {movieDetails.rate && (
                        <div style={{
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: 16,
                          padding: "18px 20px",
                          display: "flex",
                          alignItems: "center",
                          gap: 20,
                          marginBottom: 16,
                        }}>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ fontSize: 42, fontWeight: 300, color: "var(--white)", lineHeight: 1 }}>
                              {movieDetails.rate}
                            </div>
                            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                              {(rawDetails?.vote_count || 0).toLocaleString()} голосів
                            </div>
                          </div>
                          <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.08)" }} />
                          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                            <div style={{
                              background: "rgba(255,255,255,0.1)",
                              borderRadius: 999,
                              padding: "12px 28px",
                              fontSize: 15,
                              fontWeight: 700,
                              color: "var(--white)",
                            }}>
                              TMDB
                            </div>
                          </div>
                        </div>
                      )}

                      {reviews.length > 0 && (
                        <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", paddingBottom: 4 }} className="hide-scrollbar">
                          {reviews.slice(0, 10).map((review) => {
                            const avatar = review.author_details?.avatar_path
                              ? review.author_details.avatar_path.startsWith("/https")
                                ? review.author_details.avatar_path.slice(1)
                                : `https://image.tmdb.org/t/p/w45${review.author_details.avatar_path}`
                              : null;
                            const rating = review.author_details?.rating;
                            const date = review.created_at
                              ? new Date(review.created_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" })
                              : "";
                            return (
                              <div key={review.id} style={{ flexShrink: 0, width: "80vw", maxWidth: 320, background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {avatar ? (
                                    <img src={avatar} alt={review.author} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0, alignSelf: "center" }} />
                                  ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "rgba(255,255,255,0.5)", alignSelf: "center" }}>
                                      {(review.author || "?")[0].toUpperCase()}
                                    </div>
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--white)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{review.author}</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{date}</div>
                                  </div>
                                  {rating != null && (
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "none", border: "1.5px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1, fontSize: 14, fontWeight: 400, color: "var(--white)", flexShrink: 0, marginLeft: 8, alignSelf: "center" }}>
                                      {rating}
                                    </div>
                                  )}
                                </div>
                                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                  {review.content}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  )}

                  {/* 5. Інфо — кнопка */}
                  <button
                    onClick={() => setInfoOpen(true)}
                    type="button"
                    style={{
                      marginTop: 24,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 20px",
                      borderRadius: 999,
                      border: "1.5px solid rgba(255,255,255,0.15)",
                      background: "none",
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Детальна інформація
                  </button>

                  {/* Info modal */}
                  {infoOpen && (
                    <div
                      onClick={() => setInfoOpen(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0" }}
                    >
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ width: "100%", maxWidth: 560, background: "#1a1a1a", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", maxHeight: "80vh", overflowY: "auto" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: "var(--white)" }}>Детальна інформація</span>
                          <button onClick={() => setInfoOpen(false)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
                          {movieDetails.genre?.length > 0 && <InfoCard label="Жанр" value={movieDetails.genre.join(", ")} />}
                          {(rawDetails?.production_countries || []).length > 0 && <InfoCard label="Країна" value={rawDetails.production_countries.map(c => c.name).join(", ")} />}
                          {movieDetails.release_date && <InfoCard label="Рік" value={movieDetails.release_date} />}
                          {movieDetails.duration && <InfoCard label="Тривалість" value={movieDetails.duration} />}
                          {rawDetails?.status && <InfoCard label="Статус" value={rawDetails.status} />}
                          {rawDetails?.original_language && <InfoCard label="Мова оригіналу" value={rawDetails.original_language.toUpperCase()} />}
                          {(rawDetails?.spoken_languages || []).length > 0 && <InfoCard label="Мови" value={rawDetails.spoken_languages.map(l => l.name).join(", ")} />}
                          {(rawDetails?.credits?.crew || []).filter(c => c.job === "Director").length > 0 && <InfoCard label="Режисер" value={rawDetails.credits.crew.filter(c => c.job === "Director").slice(0,3).map(d => d.name).join(", ")} />}
                          {(rawDetails?.credits?.crew || []).filter(c => c.job === "Screenplay" || c.job === "Writer").length > 0 && <InfoCard label="Сценарій" value={rawDetails.credits.crew.filter(c => c.job === "Screenplay" || c.job === "Writer").slice(0,3).map(d => d.name).join(", ")} />}
                          {rawDetails?.budget > 0 && <InfoCard label="Бюджет" value={`$${(rawDetails.budget / 1e6).toFixed(1)}M`} />}
                          {rawDetails?.revenue > 0 && <InfoCard label="Збори" value={`$${(rawDetails.revenue / 1e6).toFixed(1)}M`} />}
                          {mediaType === "tv" && rawDetails?.number_of_seasons && <InfoCard label="Сезони" value={rawDetails.number_of_seasons} />}
                          {mediaType === "tv" && rawDetails?.number_of_episodes && <InfoCard label="Епізоди" value={rawDetails.number_of_episodes} />}
                          {mediaType === "tv" && (rawDetails?.created_by || []).length > 0 && <InfoCard label="Створив" value={rawDetails.created_by.map(c => c.name).join(", ")} />}
                          {mediaType === "tv" && (rawDetails?.networks || []).length > 0 && <InfoCard label="Мережа" value={rawDetails.networks.map(n => n.name).join(", ")} />}
                          {(rawDetails?.production_companies || []).length > 0 && <InfoCard label="Студія" value={rawDetails.production_companies.slice(0,3).map(c => c.name).join(", ")} />}
                          {movieDetails.rate && <InfoCard label="Рейтинг TMDB" value={`${movieDetails.rate} / 10 (${(rawDetails?.vote_count || 0).toLocaleString()} голосів)`} />}
                        </div>
                      </div>
                    </div>
                  )}


                  {/* 7. Акторський склад */}
                  <MovieCast
                    actors={[...(movieDetails.directors || []), ...(movieDetails.actors || [])]}
                    title="Акторський склад"
                  />

                </section>
              </div>

              {collectionItems.length > 0 && (
                <div className="container" style={{ marginTop: 8 }}>
                  <ContentRowSwiper
                    data={collectionItems}
                    title="Інші частини"
                    CardComponent={MediaCard}
                    cardProps={{ onMovieSelect: handleRecommendationSelect }}
                    rows={1}
                  />
                </div>
              )}

              {recommendations.length > 0 && (
                <div className="container" style={{ marginTop: 8 }}>
                  <ContentRowSwiper
                    data={recommendations}
                    title="Схожі"
                    CardComponent={MediaCard}
                    cardProps={{ onMovieSelect: handleRecommendationSelect }}
                    rows={1}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {torrentOpen && (
        <TorrentModal
          title={title}
          titleOriginal={titleOriginal}
          year={year}
          imdbId={rawDetails?.imdb_id || rawDetails?.external_ids?.imdb_id}
          tmdbId={tmdbId}
          mediaType={mediaType}
          poster={movieDetails?.poster_tmdb || ""}
          runtimeMinutes={rawDetails?.runtime || null}
          titleEnglish={titleEnglish}
          titlePolish={titlePolish}
          watchedMagnet={null}
          onClose={() => setTorrentOpen(false)}
          onPlayInBrowser={handlePlayInBrowser}
          onSendToTv={playerOnline ? handleSendToTv : null}
        />
      )}
      <VideoModal video={activeVideo} onClose={() => setActiveVideo(null)} />
    </div>
  );
}
