import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import config from "../core/config";
import {
  PlayIcon,
  PauseIcon,
  Volume2Icon,
  VolumeXIcon,
  MaximizeIcon,
  MinimizeIcon,
  RotateCcwIcon,
  RotateCwIcon,
  CaptionsIcon,
} from "lucide-react";
import { ReactComponent as BackIcon } from "../assets/icons/player_back_icon.svg";
import { ReactComponent as SettingsIcon } from "../assets/icons/settings.svg";

import "../styles/VideoPlayer.css";
import { getProgress, saveProgress } from "../api/hdrezka/progressApi";

function parseSubtitleTime(str) {
  const parts = str.replace(",", ".").split(":");
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function parseSubtitles(text) {
  // Normalize line endings and strip BOM/special prefixes
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.trim().split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n").map((l) => l.trim());
    if (lines.length < 2) continue;
    // Skip header block (!WEBVTT, WEBVTT, NOTE, STYLE, REGION)
    if (/^!?WEBVTT|^NOTE|^STYLE|^REGION/.test(lines[0])) continue;
    let i = 0;
    // Skip numeric/string cue id if present
    if (!lines[0].includes("-->") && lines[1]?.includes("-->")) i = 1;
    if (i >= lines.length) continue;
    const timeMatch = lines[i].match(
      /(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!timeMatch) continue;
    const start = parseSubtitleTime(timeMatch[1]);
    const end = parseSubtitleTime(timeMatch[2]);
    const cueText = lines
      .slice(i + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (cueText) cues.push({ start, end, text: cueText });
  }
  return cues;
}

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
  const { selectedEpisode, selectedSeason, movieDetails, movie_url, sources, subtitles = [] } =
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
  const subtitleMenuRef = useRef(null);
  const hoverVideoRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const progressWrapRef = useRef(null);

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

  const [currentSubtitle, setCurrentSubtitle] = useState(null); // { lang, url } or null
  const [isSubtitleMenuOpen, setIsSubtitleMenuOpen] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState([]);
  const [currentCueText, setCurrentCueText] = useState("");
  const subtitleCuesRef = useRef([]); // ref to avoid stale closure in handleTimeUpdate

  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);

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

  /* --- keep ref in sync with cues state --- */
  useEffect(() => {
    subtitleCuesRef.current = subtitleCues;
  }, [subtitleCues]);

  /* --- load & parse subtitle when changed --- */
  useEffect(() => {
    if (!currentSubtitle) {
      subtitleCuesRef.current = [];
      setSubtitleCues([]);
      setCurrentCueText("");
      return;
    }
    const proxyUrl = `${config.backend_url}/api/v1/rezka/subtitle_proxy?url=${encodeURIComponent(currentSubtitle.url)}`;
    fetch(proxyUrl)
      .then((r) => r.text())
      .then((text) => {
        const cues = parseSubtitles(text);
        subtitleCuesRef.current = cues;
        setSubtitleCues(cues);
      })
      .catch((err) => console.error("Subtitle load error:", err));
  }, [currentSubtitle]);

  /* --- preview: sync hidden video src with quality --- */
  useEffect(() => {
    const hv = hoverVideoRef.current;
    if (!hv || !currentSource?.url) return;
    hv.src = currentSource.url;
    hv.preload = "auto";
  }, [currentSource]);

  /* --- preview: draw frame to canvas on seeked --- */
  useEffect(() => {
    const hv = hoverVideoRef.current;
    const canvas = previewCanvasRef.current;
    if (!hv || !canvas) return;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      ctx.drawImage(hv, 0, 0, canvas.width, canvas.height);
    };
    hv.addEventListener("seeked", draw);
    return () => hv.removeEventListener("seeked", draw);
  }, []);

  const handleProgressMouseMove = (e) => {
    const wrap = progressWrapRef.current;
    if (!wrap || !duration) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = ratio * duration;
    setHoverTime(time);
    setHoverX(e.clientX - rect.left);
    const hv = hoverVideoRef.current;
    if (hv && hv.readyState >= 1) hv.currentTime = time;
  };

  const handleProgressMouseLeave = () => setHoverTime(null);

  /* --- find current cue (uses ref to avoid stale closure) --- */
  const handleTimeUpdate = () => {
    if (isScrubbing) return;
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    setCurrentTime(t);
    const cues = subtitleCuesRef.current;
    if (cues.length) {
      const cue = cues.find((c) => t >= c.start && t <= c.end);
      setCurrentCueText(cue ? cue.text : "");
    } else {
      setCurrentCueText("");
    }
  };

  /* --- close subtitle menu on outside click --- */
  useEffect(() => {
    if (!isSubtitleMenuOpen) return;
    const handler = (e) => {
      if (subtitleMenuRef.current && !subtitleMenuRef.current.contains(e.target)) {
        setIsSubtitleMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isSubtitleMenuOpen]);

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

  /* --- Signal to global TV nav that player is active --- */
  useEffect(() => {
    document.body.dataset.tvPlayerActive = 'true';
    return () => {
      delete document.body.dataset.tvPlayerActive;
    };
  }, []);

  /* --- hotkeys (keyboard + TV remote) --- */
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
        // Play / Pause
        // Enter = OK button on TV remote
        case "Enter":
        case "Space":
        case "Spacebar":
          e.preventDefault();
          togglePlay();
          handleUserActivity();
          break;

        // Seek — Left/Right on TV remote
        case "ArrowRight":
          e.preventDefault();
          seekBy(10);
          handleUserActivity();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-10);
          handleUserActivity();
          break;

        // Up/Down — just show controls on TV (volume = hardware buttons)
        case "ArrowUp":
        case "ArrowDown":
          e.preventDefault();
          handleUserActivity();
          break;

        // Media keys (physical play/pause button on remote)
        case "MediaPlayPause":
          e.preventDefault();
          togglePlay();
          handleUserActivity();
          break;
        case "MediaFastForward":
          e.preventDefault();
          seekBy(30);
          handleUserActivity();
          break;
        case "MediaRewind":
          e.preventDefault();
          seekBy(-30);
          handleUserActivity();
          break;

        // Back button on TV remote (fires as Escape in WebView)
        case "Escape":
          e.preventDefault();
          if (isQualityMenuOpen) {
            setIsQualityMenuOpen(false);
          } else {
            navigate(-1);
          }
          break;

        // Desktop: fullscreen toggle
        case "KeyF":
          toggleFullscreen();
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQualityMenuOpen]);

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
      className={"cinema-player-root" + (showControls ? " is-ui" : " is-no-ui")}
      ref={rootRef}
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
    >
      {/* video */}
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

      {/* cinematic scrims (как Netflix/Apple TV) */}
      <div className="cinema-player-scrim cinema-player-scrim--top" />
      <div className="cinema-player-scrim cinema-player-scrim--bottom" />

      {/* buffering */}
      {isBuffering && (
        <div className="cinema-player-loading">
          <div className="cinema-player-spinner" />
        </div>
      )}

      {/* Hidden video for timeline preview */}
      <video ref={hoverVideoRef} style={{ display: "none" }} muted playsInline />

      {/* Subtitle overlay */}
      {currentCueText && (
        <div className={`cinema-player-subtitle-overlay${showControls ? " cinema-player-subtitle-overlay--up" : ""}`}>
          {currentCueText.split("\n").map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <>
          {/* TOP BAR */}
          <div className="cinema-player-top-bar">
            <button
              className="cinema-player-back-btn"
              onClick={() => navigate("/")}
              aria-label="Back"
            >
              <BackIcon className="cinema-player-back-icon" />
            </button>

            <div className="cinema-player-top-meta">
              <div className="cinema-player-title">
                {movieDetails.title}
                {selectedSeason != null &&
                  selectedEpisode != null &&
                  ` • S${selectedSeason}E${selectedEpisode}`}
              </div>
              <div className="cinema-player-subtitle">
                {currentQuality
                  ? `Quality: ${String(currentQuality).replace("_Ultra", "")}`
                  : ""}
              </div>
            </div>

            <div className="cinema-player-top-actions">
              <button
                className="cinema-player-pill"
                onClick={toggleFullscreen}
                aria-label="Fullscreen"
                title="Fullscreen (F)"
              >
                {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
              </button>
            </div>
          </div>

          {/* CENTER */}
          <div className="cinema-player-center">
            <button
              className="cinema-player-skip"
              onClick={() => seekBy(-10)}
              aria-label="Rewind 10s"
              title="-10s (←)"
            >
              <RotateCcwIcon />
              <span>10</span>
            </button>

            <button
              className="cinema-player-main-btn"
              onClick={togglePlay}
              aria-label="Play/Pause"
              title="Play/Pause (Space)"
            >
              {isPlaying ? <PauseIcon size={40} /> : <PlayIcon size={40} />}
            </button>

            <button
              className="cinema-player-skip"
              onClick={() => seekBy(10)}
              aria-label="Forward 10s"
              title="+10s (→)"
            >
              <RotateCwIcon />
              <span>10</span>
            </button>
          </div>

          {/* BOTTOM */}
          <div className="cinema-player-bottom">
            {/* progress */}
            <div className="cinema-player-progress-row">
              <span className="cinema-player-time">
                {formatTime(currentTime)}
              </span>

              <div
                className="cinema-player-progress-wrap"
                ref={progressWrapRef}
                onMouseMove={handleProgressMouseMove}
                onMouseLeave={handleProgressMouseLeave}
              >
                {/* Thumbnail preview */}
                <div
                  className={`cinema-player-preview${hoverTime !== null ? " cinema-player-preview--visible" : ""}`}
                  style={{
                    left: Math.max(80, Math.min(hoverX, (progressWrapRef.current?.offsetWidth || 320) - 80)),
                  }}
                >
                  <canvas ref={previewCanvasRef} width={160} height={90} className="cinema-player-preview-canvas" />
                  <div className="cinema-player-preview-time">{hoverTime !== null ? formatTime(hoverTime) : ""}</div>
                </div>

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
                    backgroundSize: `${progressPercent}% 100%, 100% 100%`,
                  }}
                />
              </div>

              <span className="cinema-player-time">{formatTime(duration)}</span>
            </div>

            {/* controls row */}
            <div className="cinema-player-controls-row">
              <div className="cinema-player-controls-left">
                <button
                  className="cinema-player-icon-btn"
                  onClick={togglePlay}
                  aria-label="Play/Pause"
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>

                <button
                  className="cinema-player-icon-btn"
                  onClick={() => seekBy(-10)}
                  aria-label="Rewind 10s"
                >
                  <RotateCcwIcon />
                </button>

                <button
                  className="cinema-player-icon-btn"
                  onClick={() => seekBy(10)}
                  aria-label="Forward 10s"
                >
                  <RotateCwIcon />
                </button>

                <button
                  className="cinema-player-icon-btn"
                  onClick={toggleMute}
                  aria-label="Mute"
                >
                  {isMuted ? <VolumeXIcon /> : <Volume2Icon />}
                </button>

                <div className="cinema-player-volume-wrap">
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
              </div>

              <div className="cinema-player-controls-center">
                <span className="cinema-player-now-playing">
                  {movieDetails.title}
                </span>
              </div>

              <div className="cinema-player-controls-right">
                {/* Subtitle menu */}
                {subtitles.length > 0 && (
                  <div ref={subtitleMenuRef} style={{ position: "relative" }}>
                    <button
                      className={`cinema-player-pill${currentSubtitle ? " cinema-player-pill--active" : ""}`}
                      onClick={() => setIsSubtitleMenuOpen((p) => !p)}
                      aria-label="Subtitles"
                      title="Subtitles"
                    >
                      <CaptionsIcon size={16} />
                    </button>
                    {isSubtitleMenuOpen && (
                      <div className="cinema-player-quality-menu">
                        <div className="cinema-player-quality-menu-title">Субтитри</div>
                        <div className="cinema-player-quality-list">
                          <button
                            className={`cinema-player-quality-option${!currentSubtitle ? " cinema-player-quality-option--active" : ""}`}
                            onClick={() => { setCurrentSubtitle(null); setIsSubtitleMenuOpen(false); }}
                          >
                            <span className="cinema-player-quality-dot" />
                            Вимкнено
                          </button>
                          {subtitles.map((sub) => (
                            <button
                              key={sub.lang}
                              className={`cinema-player-quality-option${currentSubtitle?.lang === sub.lang ? " cinema-player-quality-option--active" : ""}`}
                              onClick={() => { setCurrentSubtitle(sub); setIsSubtitleMenuOpen(false); }}
                            >
                              <span className="cinema-player-quality-dot" />
                              {sub.lang}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quality menu */}
                <div ref={qualityMenuRef} style={{ position: "relative" }}>
                {normalizedSources.length > 1 && (
                  <>
                    <button
                      className="cinema-player-pill cinema-player-pill--settings"
                      onClick={() => setIsQualityMenuOpen((prev) => !prev)}
                      aria-label="Quality"
                      title="Quality"
                    >
                      <SettingsIcon className="cinema-player-settings-icon" />
                      <span className="cinema-player-pill-text">
                        {String(currentQuality || "auto").replace("_Ultra", "")}
                      </span>
                    </button>

                    {isQualityMenuOpen && (
                      <div className="cinema-player-quality-menu">
                        <div className="cinema-player-quality-menu-title">
                          Якість
                        </div>
                        <div className="cinema-player-quality-list">
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
                                <span className="cinema-player-quality-dot" />
                                {s.quality.replace("_Ultra", "")}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                </div>

                <button
                  className="cinema-player-pill"
                  onClick={toggleFullscreen}
                  aria-label="Fullscreen"
                >
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
