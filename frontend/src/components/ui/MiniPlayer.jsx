import React, { useMemo, useCallback, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Play, Pause } from "lucide-react";

import usePlayerStatus from "../../hooks/usePlayerStatus";
import nestifyPlayerClient from "../../api/ws/nestifyPlayerClient";
import { toRezkaSlug } from "../../core/rezkaLink";

import "../../styles/MiniPlayer.css";

const formatTime = (sec) => {
  const total = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

function MiniPlayerInner() {
  const { status } = usePlayerStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const state = status?.state || (status?.is_playing ? "playing" : "paused");

  const isActive = useMemo(() => {
    return (
      !!status &&
      !!(status.link || status.title) &&
      state !== "stopped" &&
      state !== "idle"
    );
  }, [status, state]);

  const currentSlug = useMemo(() => {
    if (!status?.link) return null;
    try {
      return toRezkaSlug(status.link);
    } catch {
      return null;
    }
  }, [status?.link]);

  const isOnCurrentMoviePage = useMemo(() => {
    if (!currentSlug) return false;
    const path = location.pathname || "";
    if (!path.startsWith("/movie/")) return false;
    return path.slice("/movie/".length) === currentSlug;
  }, [location.pathname, currentSlug]);

  const isOnPlayerPage = useMemo(() => {
    return (location.pathname || "").startsWith("/player/");
  }, [location.pathname]);

  const shouldShow = useMemo(() => {
    return isActive && !isOnCurrentMoviePage && !isOnPlayerPage;
  }, [isActive, isOnCurrentMoviePage, isOnPlayerPage]);

  const isPlaying = useMemo(() => {
    return !!(status && (status.is_playing || state === "playing"));
  }, [status, state]);

  const title = status?.title || "Без назви";
  const originName =
    status?.origin_name || status?.originName || status?.link || "";
  const season = status?.season;
  const episode = status?.episode;
  const image = status?.image;

  const currentSec = useMemo(() => {
    return status ? Math.floor((status.position_ms || 0) / 1000) : 0;
  }, [status]);

  const durationSec = useMemo(() => {
    return status
      ? Math.max(0, Math.floor((status.duration_ms || 0) / 1000))
      : 0;
  }, [status]);

  const progressPercent = useMemo(() => {
    if (!durationSec) return 0;
    return Math.min(100, (currentSec / durationSec) * 100);
  }, [currentSec, durationSec]);

  const meta = useMemo(() => {
    const base = originName || "";
    if (season != null && episode != null)
      return `${base} • S${season}E${episode}`;
    return base;
  }, [originName, season, episode]);

  const handleCardClick = useCallback(() => {
    if (!currentSlug) return;
    navigate(`/movie/${currentSlug}`);
  }, [currentSlug, navigate]);

  const handlePlayPause = useCallback((e) => {
    e.stopPropagation();
    nestifyPlayerClient.playPause();
  }, []);

  // ===== Ring math =====
  const r = 20;
  const c = 2 * Math.PI * r;

  const dashOffset = useMemo(() => {
    const p = Math.max(0, Math.min(100, progressPercent));
    return c * (1 - p / 100);
  }, [progressPercent, c]);

  if (!shouldShow) return null;

  return (
    <div className="mini-player-wrapper">
      <div
        className="mini-player"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
      >
        {/* Ring + thumb */}
        <div className="mini-player__ring" aria-hidden="true">
          <svg className="mini-player__ring-svg" viewBox="0 0 46 46">
            <circle className="mini-player__ring-track" cx="23" cy="23" r={r} />
            <circle
              className="mini-player__ring-progress"
              cx="23"
              cy="23"
              r={r}
              strokeDasharray={c}
              strokeDashoffset={dashOffset}
            />
          </svg>

          <div
            className={`mini-player__thumb ${
              !image ? "mini-player__thumb--placeholder" : ""
            }`}
            style={image ? { backgroundImage: `url(${image})` } : undefined}
          />
        </div>

        {/* Text */}
        <div className="mini-player__content">
          <div className="mini-player__title-row">
            <div className="mini-player__title" title={title}>
              {title}
            </div>
          </div>

          {!!meta && (
            <div className="mini-player__meta" title={meta}>
              {/* {meta} */}
              <div className="mini-player__time-row">
                <span className="mini-player__time">
                  {formatTime(currentSec)}
                  {durationSec > 0 ? ` / ${formatTime(durationSec)}` : ""}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Play */}
        <button
          className="mini-player__play-btn"
          onClick={handlePlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
          type="button"
        >
          {isPlaying ? (
            <Pause className="mini-player__icon" />
          ) : (
            <Play className="mini-player__icon" />
          )}
        </button>
      </div>
    </div>
  );
}

export default memo(MiniPlayerInner);
