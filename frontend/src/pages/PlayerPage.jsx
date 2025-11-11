import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  PlayIcon,
  PauseIcon,
  Volume2Icon,
  VolumeXIcon,
  MaximizeIcon,
  MinimizeIcon,
  RotateCcwIcon,
  RotateCwIcon,
} from "lucide-react";
import { ReactComponent as BackIcon } from "../assets/icons/player_back_icon.svg";
import { ReactComponent as SettingsIcon } from "../assets/icons/settings.svg";

import "../styles/VideoPlayer.css";
import { getProgress, saveProgress } from "../api/hdrezka/progressApi";

function formatTime(sec) {
  const total = Math.floor(sec || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export default function PlayerPage() {
  const { state } = useLocation();
  const { selectedEpisode, selectedSeason, movieDetails, movie_url, sources } =
    state ?? {};

  const normalizedSources =
    Array.isArray(sources) && sources.length
      ? sources
      : movie_url
      ? [{ quality: "auto", url: movie_url }]
      : [];

  const userId = JSON.parse(localStorage.getItem("current_user"))?.id;
  const navigate = useNavigate();

  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const qualitySwitchRef = useRef(null);
  const qualityMenuRef = useRef(null);

  const [startPos, setStartPos] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentQuality, setCurrentQuality] = useState(null);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    if (!normalizedSources.length) return;
    if (!currentQuality) {
      setCurrentQuality(
        normalizedSources[normalizedSources.length - 1].quality
      );
    }
  }, [normalizedSources, currentQuality]);

  const currentSource =
    normalizedSources.find((s) => s.quality === currentQuality) ||
    normalizedSources[normalizedSources.length - 1] ||
    null;

  /* --- getProgress --- */
  useEffect(() => {
    if (!movieDetails || !userId) return;

    let cancelled = false;
    (async () => {
      try {
        const { position_seconds } = await getProgress({
          user_id: userId,
          movie_id: movieDetails.id,
          season: selectedSeason ?? null,
          episode: selectedEpisode ?? null,
        });
        if (!cancelled) setStartPos(position_seconds || 0);
      } catch (e) {
        console.error("getProgress error", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, movieDetails, selectedSeason, selectedEpisode]);

  /* --- apply startPos + autoplay --- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || startPos === null || !currentSource) return;

    const applyStart = () => {
      try {
        if (startPos > 0) video.currentTime = startPos;
        setIsBuffering(true);
        video
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            setIsPlaying(false);
            setIsBuffering(false);
          });
      } catch (e) {
        console.error(e);
      }
    };

    if (video.readyState >= 1) {
      applyStart();
    } else {
      video.addEventListener("loadedmetadata", applyStart);
      return () => video.removeEventListener("loadedmetadata", applyStart);
    }
  }, [startPos, currentSource]);

  /* --- auto-hide controls --- */
  const scheduleHideControls = useCallback(() => {
    clearTimeout(hideControlsTimeoutRef.current);
    hideControlsTimeoutRef.current = setTimeout(
      () => setShowControls(false),
      2500
    );
  }, []);

  const handleUserActivity = () => {
    setShowControls(true);
    scheduleHideControls();
  };

  useEffect(() => {
    if (!isPlaying) return;
    scheduleHideControls();
    return () => clearTimeout(hideControlsTimeoutRef.current);
  }, [isPlaying, scheduleHideControls]);

  /* --- video events --- */
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
  };

  const handleLoadedData = () => {
    setIsBuffering(false);
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handlePlaying = () => {
    setIsBuffering(false);
  };

  const handleTimeUpdate = () => {
    if (isScrubbing) return;
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      setIsBuffering(true);
      video
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
          setIsBuffering(false);
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const seekBy = (delta) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(Math.max(video.currentTime + delta, 0), duration);
    video.currentTime = next;
    setCurrentTime(next);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !isMuted;
    video.muted = next;
    setIsMuted(next);
    if (!next && video.volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const v = Number(e.target.value);
    video.volume = v;
    video.muted = v === 0;
    setVolume(v);
    setIsMuted(v === 0);
  };

  /* --- scrubbing --- */
  const handleScrubStart = () => setIsScrubbing(true);

  const handleScrubChange = (e) => {
    const value = Number(e.target.value);
    setCurrentTime(value);
  };

  const handleScrubEnd = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = currentTime;
    setIsScrubbing(false);

    if (!movieDetails || !userId) return;
    saveProgress({
      user_id: userId,
      movie_id: movieDetails.id,
      position_seconds: Math.floor(currentTime),
      season: selectedSeason ?? null,
      episode: selectedEpisode ?? null,
      // 🔥 передаємо загальну тривалість
      duration: Math.floor(video.duration || duration || 0),
    });
  };

  /* --- quality change --- */
  const handleChangeQuality = (quality) => {
    if (quality === currentQuality) return;
    const video = videoRef.current;
    if (!video) return;

    qualitySwitchRef.current = {
      time: video.currentTime,
      wasPlaying: !video.paused,
    };

    setIsBuffering(true);
    setCurrentQuality(quality);
    setIsQualityMenuOpen(false);
  };

  useEffect(() => {
    if (!qualitySwitchRef.current) return;
    const video = videoRef.current;
    if (!video || !currentSource) return;

    const saved = qualitySwitchRef.current;

    const apply = () => {
      try {
        video.currentTime = saved.time || 0;
        if (saved.wasPlaying) {
          video
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      } finally {
        qualitySwitchRef.current = null;
        setIsBuffering(false);
      }
    };

    if (video.readyState >= 1) {
      apply();
    } else {
      video.addEventListener("loadedmetadata", apply, { once: true });
      return () => video.removeEventListener("loadedmetadata", apply);
    }
  }, [currentSource]);

  /* --- fullscreen --- */
  const toggleFullscreen = () => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return;

    const doc = document;
    const isFS =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement;

    if (!isFS) {
      if (root.requestFullscreen) {
        root.requestFullscreen();
        setIsFullscreen(true);
      } else if (root.webkitRequestFullscreen) {
        root.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () =>
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        )
      );
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  /* --- close quality menu on outside click --- */
  useEffect(() => {
    if (!isQualityMenuOpen) return;

    const handleClickOutside = (e) => {
      if (
        qualityMenuRef.current &&
        !qualityMenuRef.current.contains(e.target)
      ) {
        setIsQualityMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isQualityMenuOpen]);

  /* --- autosave progress every 30s --- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !movieDetails || !userId) return;

    const saveTick = () => {
      if (video.paused) return;
      saveProgress({
        user_id: userId,
        movie_id: movieDetails.id,
        position_seconds: Math.floor(video.currentTime),
        season: selectedSeason ?? null,
        episode: selectedEpisode ?? null,
        // 🔥 duration теж відправляємо
        duration: Math.floor(video.duration || duration || 0),
      });
    };

    if (isPlaying) {
      saveIntervalRef.current = setInterval(saveTick, 30000);
    }

    return () => clearInterval(saveIntervalRef.current);
  }, [
    isPlaying,
    userId,
    movieDetails,
    selectedSeason,
    selectedEpisode,
    duration,
  ]);

  const handlePause = () => {
    setIsPlaying(false);
    const video = videoRef.current;
    if (!video || !movieDetails || !userId) return;
    saveProgress({
      user_id: userId,
      movie_id: movieDetails.id,
      position_seconds: Math.floor(video.currentTime),
      season: selectedSeason ?? null,
      episode: selectedEpisode ?? null,
      // 🔥 і тут
      duration: Math.floor(video.duration || duration || 0),
    });
  };

  /* --- hotkeys --- */
  useEffect(() => {
    const handler = (e) => {
      const video = videoRef.current;
      if (!video) return;

      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          document.activeElement.isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
        case "Spacebar":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(10);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-10);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange({
            target: { value: Math.min(1, volume + 0.1) },
          });
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange({
            target: { value: Math.max(0, volume - 0.1) },
          });
          break;
        case "KeyF":
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [volume]);

  if (!movieDetails || !normalizedSources.length) {
    return (
      <div className="cinema-player-fallback">
        <div className="cinema-player-fallback-content">
          <h2>Ooops.. 404</h2>
          <p>Не вдалося завантажити дані для цього фільму.</p>
          <button
            onClick={() => navigate("/")}
            className="cinema-player-fallback-btn"
          >
            <BackIcon />
            На головну
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cinema-player-root"
      ref={rootRef}
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
    >
      <video
        ref={videoRef}
        className="cinema-player-video"
        src={currentSource?.url || ""}
        onClick={togglePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={handleLoadedData}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onTimeUpdate={handleTimeUpdate}
        onPause={handlePause}
        playsInline
      />

      {isBuffering && (
        <div className="cinema-player-loading">
          <div className="cinema-player-spinner" />
        </div>
      )}

      {showControls && (
        <>
          <div className="cinema-player-top-bar">
            <button
              className="cinema-player-back-btn"
              onClick={() => navigate("/")}
            >
              <BackIcon className="cinema-player-back-icon" />
            </button>
            <span className="cinema-player-title">
              {movieDetails.title}
              {selectedSeason != null &&
                selectedEpisode != null &&
                ` • S${selectedSeason}E${selectedEpisode}`}
            </span>
          </div>

          <div className="cinema-player-center">
            <button
              className="cinema-player-circle-btn"
              onClick={() => seekBy(-10)}
            >
              <RotateCcwIcon />
              <span>10</span>
            </button>

            <button className="cinema-player-main-btn" onClick={togglePlay}>
              {isPlaying ? <PauseIcon size={38} /> : <PlayIcon size={38} />}
            </button>

            <button
              className="cinema-player-circle-btn"
              onClick={() => seekBy(10)}
            >
              <RotateCwIcon />
              <span>10</span>
            </button>
          </div>

          <div className="cinema-player-bottom">
            <div className="cinema-player-progress-row">
              <span className="cinema-player-time">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={1}
                value={currentTime}
                onMouseDown={handleScrubStart}
                onTouchStart={handleScrubStart}
                onChange={handleScrubChange}
                onMouseUp={handleScrubEnd}
                onTouchEnd={handleScrubEnd}
                className="cinema-player-progress"
                style={{
                  background: `linear-gradient(to right,
                    #e50914 0%,
                    #e50914 ${progressPercent}%,
                    rgba(255,255,255,0.4) ${progressPercent}%,
                    rgba(255,255,255,0.4) 100%
                  )`,
                }}
              />
              <span className="cinema-player-time">{formatTime(duration)}</span>
            </div>

            <div className="cinema-player-controls-row">
              <div className="cinema-player-controls-left">
                <button onClick={togglePlay}>
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={() => seekBy(-10)}>
                  <RotateCcwIcon />
                </button>
                <button onClick={() => seekBy(10)}>
                  <RotateCwIcon />
                </button>
                <button onClick={toggleMute}>
                  {isMuted ? <VolumeXIcon /> : <Volume2Icon />}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="cinema-player-volume"
                />
              </div>

              <div className="cinema-player-controls-center">
                <span className="cinema-player-now-playing">
                  {movieDetails.title}
                </span>
              </div>

              <div
                className="cinema-player-controls-right"
                ref={qualityMenuRef}
              >
                {normalizedSources.length > 1 && (
                  <>
                    <button
                      className="cinema-player-settings-btn"
                      onClick={() => setIsQualityMenuOpen((prev) => !prev)}
                    >
                      <SettingsIcon className="cinema-player-settings-icon" />
                    </button>
                    {isQualityMenuOpen && (
                      <div className="cinema-player-quality-menu">
                        <div className="cinema-player-quality-menu-title">
                          Якість
                        </div>
                        {normalizedSources
                          .slice()
                          .reverse()
                          .map((s) => (
                            <button
                              key={s.quality}
                              className={
                                "cinema-player-quality-option" +
                                (s.quality === currentQuality
                                  ? " cinema-player-quality-option--active"
                                  : "")
                              }
                              onClick={() => handleChangeQuality(s.quality)}
                            >
                              {s.quality.replace("_Ultra", "")}
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}

                <button onClick={toggleFullscreen}>
                  {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
