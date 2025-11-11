import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  memo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ReactComponent as PlayerPlayIcon } from "../../assets/icons/player_play.svg";
import { ReactComponent as PlayerPauseIcon } from "../../assets/icons/player_pause.svg";

import usePlayerStatus from "../../hooks/usePlayerStatus";
import nestifyPlayerClient from "../../api/ws/nestifyPlayerClient";

import "../../styles/MiniPlayer.css";

const formatTime = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

/**
 * Хук компактного режима по скроллу.
 * Всегда вызывается, но реагирует только если enabled === true.
 */
function useScrollCompactMode(enabled = true) {
  const [isCompact, setIsCompact] = useState(false);
  const compactRef = useRef(false);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    // если неактивен — сбрасываем и не слушаем скролл
    if (!enabled) {
      compactRef.current = false;
      setIsCompact(false);
      return;
    }

    lastYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;

      if (!tickingRef.current) {
        tickingRef.current = true;

        window.requestAnimationFrame(() => {
          const diff = currentY - lastYRef.current;
          lastYRef.current = currentY;

          const threshold = 8;
          let nextCompact = compactRef.current;

          if (diff > threshold && currentY > 80) {
            // вниз → компактный
            nextCompact = true;
          }
          if (diff < -threshold || currentY < 80) {
            // вверх / почти сверху → обычный
            nextCompact = false;
          }

          if (nextCompact !== compactRef.current) {
            compactRef.current = nextCompact;
            setIsCompact(nextCompact);
          }

          tickingRef.current = false;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [enabled]);

  return isCompact;
}

function MiniPlayerInner() {
  const { status } = usePlayerStatus();
  const navigate = useNavigate();
  const location = useLocation();

  // состояние плеера
  const state = status?.state || (status?.is_playing ? "playing" : "paused");
  const isActive =
    status &&
    (status.link || status.title) &&
    state !== "stopped" &&
    state !== "idle";

  // на странице текущего фильма?
  const isOnCurrentMoviePage = useMemo(() => {
    if (!status?.link) return false;
    const path = location.pathname || "";
    if (!path.startsWith("/movie/")) return false;
    const raw = path.slice("/movie/".length);
    let decoded;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    return decoded === status.link;
  }, [location.pathname, status]);

  // скролл-хук ЗАВЖДИ вызываем, но включаем только когда реально нужно
  const isCompact = useScrollCompactMode(isActive && !isOnCurrentMoviePage);

  const isPlaying = !!(status && (status.is_playing || state === "playing"));

  const title = status?.title || "Без назви";
  const originName =
    status?.origin_name || status?.originName || status?.link || "";
  const season = status?.season;
  const episode = status?.episode;
  const image = status?.image;

  const currentSec = status ? Math.floor((status.position_ms || 0) / 1000) : 0;
  const durationSec = status
    ? Math.max(0, Math.floor((status.duration_ms || 0) / 1000))
    : 0;

  const progressPercent = useMemo(() => {
    if (!durationSec) return 0;
    return Math.min(100, (currentSec / durationSec) * 100);
  }, [currentSec, durationSec]);

  const stateText = useMemo(() => {
    if (!status || (!status.link && !status.title)) return "Плеєр готовий";
    if (state === "playing") return "Грає";
    if (state === "paused") return "На паузі";
    if (state === "stopped" || state === "idle") return "Зупинено";
    return "Плеєр";
  }, [state, status]);

  const handleCardClick = useCallback(() => {
    if (!status?.link) return;
    navigate(`/movie/${encodeURIComponent(status.link)}`);
  }, [status, navigate]);

  const handlePlayPause = useCallback((e) => {
    e.stopPropagation();
    nestifyPlayerClient.playPause();
  }, []);

  // ❗ все хуки уже ВЫШЕ, теперь можно делать ранний return
  if (!isActive || isOnCurrentMoviePage) return null;

  return (
    <div className="mini-player-wrapper">
      <div
        className={`mini-player ${isCompact ? "mini-player--compact" : ""}`}
        onClick={handleCardClick}
      >
        {image && (
          <div
            className="mini-player__thumb"
            style={{ backgroundImage: `url(${image})` }}
          />
        )}

        <div className="mini-player__content">
          <div className="mini-player__top">
            <div className="mini-player__text">
              <div className="mini-player__status">{stateText}</div>
              <div className="mini-player__title" title={title}>
                {title}
              </div>
              {originName && (
                <div className="mini-player__origin" title={originName}>
                  {originName}
                  {season != null && episode != null && (
                    <span className="mini-player__episode">
                      {" "}
                      • S{season}E{episode}
                    </span>
                  )}
                </div>
              )}
            </div>

            <button className="mini-player__play-btn" onClick={handlePlayPause}>
              {isPlaying ? (
                <PlayerPauseIcon className="mini-player__icon" />
              ) : (
                <PlayerPlayIcon className="mini-player__icon" />
              )}
            </button>
          </div>

          <div className="mini-player__progress-row">
            <div className="mini-player__progress">
              <div
                className="mini-player__progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mini-player__time">
              {formatTime(currentSec)}
              {durationSec > 0 && ` / ${formatTime(durationSec)}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MiniPlayer = memo(MiniPlayerInner);

export default MiniPlayer;
