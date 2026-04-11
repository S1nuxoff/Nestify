// src/components/movie/MovieEpisodes.jsx
import React, { useEffect } from "react";
import { Play, CheckCircle2 } from "lucide-react";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

const MovieEpisodes = ({
  movieDetails,
  selectedSeason,
  onSelectSeason,
  selectedEpisode,
  onSelectEpisode,
  seasonEpisodes = [],
  seasonLoading = false,
}) => {
  const hasEpisodes =
    movieDetails &&
    movieDetails.action === "get_stream" &&
    Array.isArray(movieDetails.episodes_schedule) &&
    movieDetails.episodes_schedule.length > 0;

  const episodeHistoryMap = new Map();
  if (Array.isArray(movieDetails?.watch_history)) {
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

  if (!hasEpisodes) return null;

  const episodes =
    seasonEpisodes.length > 0
      ? seasonEpisodes
      : (movieDetails.episodes_schedule.find(
          (s) => s.season_number === selectedSeason
        )?.episodes || []);

  return (
    <section style={{ marginBottom: 32, marginTop: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="movie-section-title">
          Сезони та епізоди
        </h2>
      </div>

      {/* Season pills */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          marginBottom: 20,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="hide-scrollbar tv-hscroll"
      >
        {movieDetails.episodes_schedule.map((s) => {
          const active = s.season_number === selectedSeason;
          return (
            <button
              key={s.season_number}
              onClick={() => onSelectSeason(s.season_number)}
              type="button"
              style={{
                flexShrink: 0,
                padding: "8px 18px",
                borderRadius: 999,
                border: active ? "2px solid rgba(255,255,255,0.4)" : "2px solid rgba(255,255,255,0.12)",
                background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                color: active ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.55)",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              Сезон {s.season_number}
            </button>
          );
        })}
      </div>

      {/* Episodes slider */}
      {seasonLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
          <div className="spinner" />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingBottom: 4,
          }}
          className="hide-scrollbar tv-hscroll"
        >
          {episodes.map((ep, idx) => {
            const epKey = `${selectedSeason}-${ep.episode_number}`;
            const hist = episodeHistoryMap.get(epKey);
            let progressPercent = null;
            let isWatched = false;
            if (hist && typeof hist.position_seconds === "number" && hist.duration > 0) {
              const ratio = Math.min(hist.position_seconds / hist.duration, 1);
              progressPercent = ratio * 100;
              isWatched = ratio >= 0.98;
            }

            const isSelected = selectedEpisode === ep.episode_number;

            return (
              <div
                key={ep.id || idx}
                onClick={() => onSelectEpisode?.(ep.episode_number)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectEpisode?.(ep.episode_number); } }}
                tabIndex={0}
                role="button"
                aria-label={`Епізод ${ep.episode_number}`}
                style={{ cursor: "pointer", flexShrink: 0, width: "62vw", maxWidth: 240 }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "16/9",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.06)",
                    marginBottom: 8,
                    outline: isSelected ? "2px solid rgba(255,255,255,0.8)" : "none",
                  }}
                >
                  {ep.still_path ? (
                    <img
                      src={`${TMDB_IMG}${ep.still_path}`}
                      alt={ep.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.05)" }} />
                  )}

                  {/* Dark overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.45))",
                    pointerEvents: "none",
                  }} />

                  {/* Play icon */}
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "rgba(255,255,255,0.18)",
                      backdropFilter: "blur(6px)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Play size={14} fill="white" stroke="none" />
                    </div>
                  </div>

                  {/* Watched check */}
                  {isWatched && (
                    <div style={{ position: "absolute", top: 6, right: 6 }}>
                      <CheckCircle2 size={18} color="#00e676" strokeWidth={2.5} />
                    </div>
                  )}

                  {/* Progress bar */}
                  {progressPercent != null && !isWatched && (
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      height: 3, background: "rgba(255,255,255,0.18)",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${progressPercent}%`,
                        background: "rgba(255,255,255,0.85)",
                      }} />
                    </div>
                  )}
                </div>

                {/* Title */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", lineHeight: 1.4, marginBottom: 2 }}>
                  S{selectedSeason}.E{ep.episode_number}
                  {ep.name && ep.name !== `Епізод ${ep.episode_number}` ? ` · ${ep.name}` : ""}
                </div>
                {ep.air_date && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    {ep.air_date}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default MovieEpisodes;
