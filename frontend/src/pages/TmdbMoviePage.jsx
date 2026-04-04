import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMovieDetails, getTvDetails, getTvSeason, getRecommendations, normalizeTmdbItem, tmdbImg, tmdbImgOriginal } from "../api/tmdb";
import ContentRowSwiper from "../components/section/ContentRowSwiper";
import MediaCard from "../components/ui/MediaCard";
import Header from "../components/layout/Header";
import MovieHeader from "../components/movie/MovieHeader";
import MovieCast from "../components/movie/MovieCast";
import MovieEpisodes from "../components/movie/MovieEpisodes";
import TorrentModal from "../components/ui/TorrentModal";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";
import { addLikedMovie, removeLikedMovie, getLikedMovieStatus } from "../api/user";
import "../styles/MoviePage.css";
import "../styles/TorrentModal.css";

const InfoCard = ({ label, value }) => (
  <div className="movie-info-card">
    <span className="movie-info-card__label">{label}</span>
    <span className="movie-info-card__value">{value}</span>
  </div>
);

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

  // Трейлер з TMDB videos
  const trailer = (details.videos?.results || []).find(
    (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
  );
  const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : "";

  // Актори у форматі MovieCast
  const actors = (details.credits?.cast || []).slice(0, 24).map((a) => ({
    id: a.id,
    name: a.name,
    photo: tmdbImg(a.profile_path, "w185"),
    job: a.character,
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
    genre: genres,
    age: details.adult ? "18+" : null,
    image: tmdbImg(details.poster_path, "w342"),
    poster_tmdb: tmdbImg(details.poster_path, "w342"),
    backdrop: tmdbImgOriginal(details.backdrop_path),
    backdrop_url_original: tmdbImgOriginal(details.backdrop_path),
    logo_url: null,
    trailer_tmdb: trailerUrl,
    action: mediaType === "tv" ? "get_stream" : "get_movie",
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
  const [playerOnline, setPlayerOnline] = useState(nestifyPlayerClient.isConnected);
  const [isLiked, setIsLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [activeTab, setActiveTab] = useState("episodes");
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [reactions, setReactions] = useState([]);

  let currentUser = null;
  try {
    const raw = localStorage.getItem("current_user");
    currentUser = raw ? JSON.parse(raw) : null;
  } catch {}

  const movieDetails = useMemo(
    () => buildMovieDetails(rawDetails, mediaType),
    [rawDetails, mediaType]
  );

  useEffect(() => {
    const handler = (status) => setPlayerOnline(status);
    nestifyPlayerClient.on("connected", handler);
    return () => nestifyPlayerClient.off("connected", handler);
  }, []);

  useEffect(() => {
    if (!tmdbId) return;
    setLoading(true);
    const fetchDetails = mediaType === "tv" ? getTvDetails : getMovieDetails;
    fetchDetails(tmdbId)
      .then(setRawDetails)
      .catch(() => setRawDetails(null))
      .finally(() => setLoading(false));

    getRecommendations(tmdbId, mediaType)
      .then((items) =>
        setRecommendations(
          items.map((i) => normalizeTmdbItem({ ...i, media_type: mediaType }))
        )
      )
      .catch(() => {});

    // Реакції з cub.rip
    const cubType = mediaType === "tv" ? "tv" : "movie";
    fetch(`https://cub.rip/api/reactions/get/${cubType}_${tmdbId}`)
      .then((r) => r.json())
      .then((d) => setReactions(d.result || []))
      .catch(() => {});
  }, [tmdbId, mediaType]);

  // Авто-вибір таба
  useEffect(() => {
    if (!movieDetails) return;
    const hasEpisodes =
      mediaType === "tv" &&
      Array.isArray(movieDetails.episodes_schedule) &&
      movieDetails.episodes_schedule.length > 0;

    if (!hasEpisodes) {
      setActiveTab("details");
    } else {
      setActiveTab("episodes");
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

  const handlePlayInBrowser = (file) => {
    navigate(`/player/tmdb_${mediaType}_${tmdbId}`, {
      state: {
        movieDetails,
        sources: [{ quality: "auto", url: file.stream_url }],
        movie_url: file.stream_url,
        subtitles: [],
      },
    });
  };

  const handleSendToTv = (file) => {
    if (!playerOnline || !movieDetails) return;
    nestifyPlayerClient.sendRpc("Player.PlayUrl", {
      url: file.stream_url,
      title: movieDetails.title,
      image: movieDetails.poster_tmdb || "",
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
                playerOnline={playerOnline}
                isLiked={isLiked}
                likePending={likePending}
                onToggleLike={toggleLike}
                onMainPlayClick={() => setTorrentOpen(true)}
                onCastClick={() => setTorrentOpen(true)}
              />

              <div className="container">
                {/* Tabs */}
                <div className="movie-page__tabs">
                  {hasEpisodes && (
                    <button
                      className={`movie-page__tab${activeTab === "episodes" ? " is-active" : ""}`}
                      onClick={() => setActiveTab("episodes")}
                      type="button"
                    >
                      Епізоди
                    </button>
                  )}
                  <button
                    className={`movie-page__tab${activeTab === "details" ? " is-active" : ""}`}
                    onClick={() => setActiveTab("details")}
                    type="button"
                  >
                    Детально
                  </button>
                </div>

                {/* Details tab */}
                {activeTab === "details" && (
                  <section className="movie-page__details">

                    {/* Реакції */}
                    {reactions.length > 0 && (
                      <div className="movie-page__reactions">
                        {["fire","nice","think","bore","shit"].map(type => {
                          const r = reactions.find(x => x.type === type);
                          if (!r) return null;
                          const count = r.counter >= 1000
                            ? (r.counter / 1000).toFixed(1).replace(".0","") + "K"
                            : r.counter;
                          return (
                            <div key={type} className="movie-page__reaction">
                              <img src={`https://cub.rip/img/reactions/${type}.svg`} alt={type} className="movie-page__reaction-icon" />
                              <span className="movie-page__reaction-count">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {movieDetails.description && (
                      <p className="movie-page__description">{movieDetails.description}</p>
                    )}
                    {rawDetails?.tagline && (
                      <p className="movie-page__tagline">«{rawDetails.tagline}»</p>
                    )}

                    <div className="movie-info-grid">
                      {movieDetails.genre?.length > 0 && (
                        <InfoCard label="Жанр" value={movieDetails.genre.join(", ")} />
                      )}
                      {(rawDetails?.production_countries || []).length > 0 && (
                        <InfoCard label="Країна" value={rawDetails.production_countries.map(c => c.name).join(", ")} />
                      )}
                      {movieDetails.release_date && (
                        <InfoCard label="Рік" value={movieDetails.release_date} />
                      )}
                      {movieDetails.duration && (
                        <InfoCard label="Тривалість" value={movieDetails.duration} />
                      )}
                      {rawDetails?.status && (
                        <InfoCard label="Статус" value={rawDetails.status} />
                      )}
                      {rawDetails?.original_language && (
                        <InfoCard label="Мова оригіналу" value={rawDetails.original_language.toUpperCase()} />
                      )}
                      {(rawDetails?.spoken_languages || []).length > 0 && (
                        <InfoCard label="Мови" value={rawDetails.spoken_languages.map(l => l.name).join(", ")} />
                      )}
                      {(rawDetails?.credits?.crew || []).filter(c => c.job === "Director").length > 0 && (
                        <InfoCard label="Режисер" value={rawDetails.credits.crew.filter(c => c.job === "Director").slice(0,3).map(d => d.name).join(", ")} />
                      )}
                      {(rawDetails?.credits?.crew || []).filter(c => c.job === "Screenplay" || c.job === "Writer").length > 0 && (
                        <InfoCard label="Сценарій" value={rawDetails.credits.crew.filter(c => c.job === "Screenplay" || c.job === "Writer").slice(0,3).map(d => d.name).join(", ")} />
                      )}
                      {rawDetails?.budget > 0 && (
                        <InfoCard label="Бюджет" value={`$${(rawDetails.budget / 1e6).toFixed(1)}M`} />
                      )}
                      {rawDetails?.revenue > 0 && (
                        <InfoCard label="Збори" value={`$${(rawDetails.revenue / 1e6).toFixed(1)}M`} />
                      )}
                      {mediaType === "tv" && rawDetails?.number_of_seasons && (
                        <InfoCard label="Сезони" value={rawDetails.number_of_seasons} />
                      )}
                      {mediaType === "tv" && rawDetails?.number_of_episodes && (
                        <InfoCard label="Епізоди" value={rawDetails.number_of_episodes} />
                      )}
                      {mediaType === "tv" && (rawDetails?.created_by || []).length > 0 && (
                        <InfoCard label="Створив" value={rawDetails.created_by.map(c => c.name).join(", ")} />
                      )}
                      {mediaType === "tv" && (rawDetails?.networks || []).length > 0 && (
                        <InfoCard label="Мережа" value={rawDetails.networks.map(n => n.name).join(", ")} />
                      )}
                      {(rawDetails?.production_companies || []).length > 0 && (
                        <InfoCard label="Студія" value={rawDetails.production_companies.slice(0,3).map(c => c.name).join(", ")} />
                      )}
                      {movieDetails.rate && (
                        <InfoCard label="Рейтинг TMDB" value={`${movieDetails.rate} / 10 (${(rawDetails?.vote_count || 0).toLocaleString()} голосів)`} />
                      )}
                    </div>

                    <MovieCast actors={movieDetails.actors} />
                  </section>
                )}

                {/* Episodes tab */}
                {activeTab === "episodes" && hasEpisodes && (
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
              </div>

              {recommendations.length > 0 && (
                <div className="container" style={{ marginTop: 8 }}>
                  <ContentRowSwiper
                    data={recommendations}
                    title="Схожі"
                    CardComponent={MediaCard}
                    cardProps={{ onMovieSelect: handleRecommendationSelect }}
                    rows={2}
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
          mediaType={mediaType}
          onClose={() => setTorrentOpen(false)}
          onPlayInBrowser={handlePlayInBrowser}
          onSendToTv={playerOnline ? handleSendToTv : null}
        />
      )}
    </div>
  );
}
