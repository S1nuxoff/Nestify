import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import config from "../core/config";
import { stopHlsSession, restartHlsSession } from "../api/v3";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  RotateCcw, RotateCw, Captions, ChevronLeft, Settings,
} from "lucide-react";

import "../styles/VideoPlayer.css";
import { getProgress, saveProgress } from "../api/hdrezka/progressApi";

/* ─── subtitle helpers ─────────────────────────────────────── */
function parseSubtitleTime(str) {
  const parts = str.replace(",", ".").split(":");
  if (parts.length === 3) return +parts[0] * 3600 + +parts[1] * 60 + +parts[2];
  return +parts[0] * 60 + +parts[1];
}

function parseSubtitles(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.trim().split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n").map(l => l.trim());
    if (lines.length < 2) continue;
    if (/^!?WEBVTT|^NOTE|^STYLE|^REGION/.test(lines[0])) continue;
    let i = 0;
    if (!lines[0].includes("-->") && lines[1]?.includes("-->")) i = 1;
    if (i >= lines.length) continue;
    const m = lines[i].match(/(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})/);
    if (!m) continue;
    const cueText = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
    if (cueText) cues.push({ start: parseSubtitleTime(m[1]), end: parseSubtitleTime(m[2]), text: cueText });
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

/* ─── component ────────────────────────────────────────────── */
export default function PlayerPage() {
  const { state } = useLocation();
  const { selectedEpisode, selectedSeason, movieDetails, movie_url, sources, subtitles = [], fileDuration = null, hlsInfo = null } = state ?? {};
  const navigate = useNavigate();

  const normalizedSources = Array.isArray(sources) && sources.length
    ? sources
    : movie_url ? [{ quality: "auto", url: movie_url }] : [];

  const userId = JSON.parse(localStorage.getItem("current_user"))?.id;

  /* refs */
  const rootRef           = useRef(null);
  const videoRef          = useRef(null);
  const hideTimerRef      = useRef(null);
  const saveIntervalRef   = useRef(null);
  const qualitySwitchRef  = useRef(null);
  const qualityMenuRef    = useRef(null);
  const subtitleMenuRef   = useRef(null);
  const progressWrapRef   = useRef(null);
  const subtitleCuesRef   = useRef([]);
  const scrubAbsRef       = useRef(null);
  const hlsRef            = useRef(null);
  const hlsTimeOffsetRef  = useRef(hlsInfo?.startOffset || 0);
  const hlsInitializedRef = useRef(false); // чи вже зробили перший autoplay

  /* transcoded stream state */
  const [transcodedOffset, setTranscodedOffset]       = useState(0);
  const [knownTotalDuration, setKnownTotalDuration]   = useState(0);

  /* player state */
  const [startPos, setStartPos]           = useState(null);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [duration, setDuration]           = useState(0);
  const [currentTime, setCurrentTime]     = useState(0);
  const [volume, setVolume]               = useState(1);
  const [isMuted, setIsMuted]             = useState(false);
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const [showControls, setShowControls]   = useState(true);
  const [isScrubbing, setIsScrubbing]     = useState(false);
  const [isBuffering, setIsBuffering]     = useState(true);
  const [currentQuality, setCurrentQuality]       = useState(null);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [currentSubtitle, setCurrentSubtitle]     = useState(null);
  const [isSubtitleMenuOpen, setIsSubtitleMenuOpen] = useState(false);
  const [subtitleCues, setSubtitleCues]   = useState([]);
  const [currentCueText, setCurrentCueText] = useState("");
  const [hoverTime, setHoverTime]         = useState(null);

  /* ── derived ── */
  useEffect(() => {
    if (!normalizedSources.length || currentQuality) return;
    setCurrentQuality(normalizedSources[normalizedSources.length - 1].quality);
  }, [normalizedSources, currentQuality]);

  const currentSource = normalizedSources.find(s => s.quality === currentQuality)
    || normalizedSources[normalizedSources.length - 1] || null;

  const isTranscoded = Boolean(currentSource?.url?.includes("transcode=true"));
  const isHls = Boolean(currentSource?.url?.endsWith(".m3u8") || currentSource?.url?.includes("/hls/"));

  useEffect(() => {
    setKnownTotalDuration(0);
    setTranscodedOffset(0);
  }, [currentSource?.url]);

  const effectiveSrc = (() => {
    if (!currentSource?.url) return "";
    if (isHls) return "";                                           // HLS.js сам керує src
    if (!isTranscoded || transcodedOffset <= 0) return currentSource.url;
    const base = currentSource.url.replace(/[&?]t=[\d.]+/g, "");
    return `${base}${base.includes("?") ? "&" : "?"}t=${transcodedOffset}`;
  })();

  const displayedCurrentTime = isHls
    ? (isScrubbing && scrubAbsRef.current !== null ? scrubAbsRef.current : hlsTimeOffsetRef.current + currentTime)
    : (!isTranscoded
        ? currentTime
        : (isScrubbing && scrubAbsRef.current !== null ? scrubAbsRef.current : transcodedOffset + currentTime));
  const tmdbDuration = movieDetails?.runtime ? movieDetails.runtime * 60 : 0;
  const fallbackDuration = fileDuration || tmdbDuration;
  const displayedDuration = isHls
    // HLS: video.duration = залишок після offset — завжди берем повну тривалість
    ? (fallbackDuration > 0 ? fallbackDuration : hlsTimeOffsetRef.current + (duration || 0))
    : (!isTranscoded
        ? duration || fallbackDuration
        : (knownTotalDuration > 0 ? knownTotalDuration : fallbackDuration));
  const progressPercent = displayedDuration > 0 ? (displayedCurrentTime / displayedDuration) * 100 : 0;
  const volumePercent = isMuted ? 0 : volume * 100;

  /* ── HLS.js ── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource?.url) return;

    // Знищуємо попередній HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!isHls) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        // Сегменти чекають через long-poll на бекенді (макс 30 сек)
        fragLoadingTimeOut: 35000,
        fragLoadingMaxRetry: 1,
        fragLoadingRetryDelay: 500,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 10000,
      });
      hls.loadSource(currentSource.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        if (!hlsInitializedRef.current) {
          // Перший запуск — FFmpeg вже стартує з потрібної позиції (startOffset),
          // тому video.currentTime завжди 0 для HLS
          hlsInitializedRef.current = true;
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        } else {
          // Після seek/restart — просто продовжуємо грати з позиції 0
          video.currentTime = 0;
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setIsBuffering(false);
      });
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari — нативна підтримка
      video.src = currentSource.url;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      hlsInitializedRef.current = false;
    };
  }, [currentSource?.url, isHls]);

  // Очистка HLS сесії на бекенді при виході з плеєра
  useEffect(() => {
    return () => {
      if (hlsInfo?.sessionId) stopHlsSession(hlsInfo.sessionId);
    };
  }, [hlsInfo?.sessionId]);

  /* ── controls auto-hide ── */
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const showAndScheduleHide = useCallback(() => {
    setShowControls(true);
    if (isPlaying) scheduleHide();
  }, [isPlaying, scheduleHide]);

  // Always show when paused
  useEffect(() => {
    if (!isPlaying) {
      clearTimeout(hideTimerRef.current);
      setShowControls(true);
    } else {
      scheduleHide();
    }
    return () => clearTimeout(hideTimerRef.current);
  }, [isPlaying, scheduleHide]);

  /* ── getProgress ── */
  useEffect(() => {
    if (!movieDetails || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { position_seconds } = await getProgress({
          user_id: userId, movie_id: movieDetails.id,
          season: selectedSeason ?? null, episode: selectedEpisode ?? null,
        });
        if (!cancelled) setStartPos(position_seconds || 0);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [userId, movieDetails, selectedSeason, selectedEpisode]);

  /* ── apply startPos + autoplay ── */
  useEffect(() => {
    const video = videoRef.current;
    // HLS: autoplay + seek handled in MANIFEST_PARSED (FFmpeg starts at correct offset)
    if (!video || startPos === null || !currentSource || isHls) return;
    const apply = () => {
      try {
        if (startPos > 0) video.currentTime = startPos;
        setIsBuffering(true);
        video.play().then(() => setIsPlaying(true)).catch(() => { setIsPlaying(false); setIsBuffering(false); });
      } catch {}
    };
    if (video.readyState >= 1) apply();
    else { video.addEventListener("loadedmetadata", apply); return () => video.removeEventListener("loadedmetadata", apply); }
  }, [startPos, currentSource]);

  /* ── video events ── */
  const handleDurationChange = () => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    if (!isFinite(d) || d <= 0 || d >= 86400) return;
    if (isTranscoded) {
      const candidate = transcodedOffset + d;
      setKnownTotalDuration(prev => prev > 0 ? prev : candidate);
      setDuration(d);
    } else {
      setDuration(d);
    }
  };

  const handleLoadedMetadata = () => {
    handleDurationChange();
  };

  const handleTimeUpdate = () => {
    if (isScrubbing) return;
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    setCurrentTime(t);
    const cues = subtitleCuesRef.current;
    if (cues.length) {
      const cue = cues.find(c => t >= c.start && t <= c.end);
      setCurrentCueText(cue ? cue.text : "");
    } else setCurrentCueText("");
  };

  const handlePause = () => {
    setIsPlaying(false);
    const video = videoRef.current;
    if (!video || !movieDetails || !userId) return;
    const absPosition = isHls
      ? Math.floor(hlsTimeOffsetRef.current + video.currentTime)
      : Math.floor(video.currentTime);
    saveProgress({
      user_id: userId, movie_id: movieDetails.id,
      position_seconds: absPosition,
      season: selectedSeason ?? null, episode: selectedEpisode ?? null,
      duration: Math.floor(displayedDuration || video.duration || 0),
      torrent_hash: hlsInfo?.hash || null,
      torrent_file_id: hlsInfo?.fileId != null ? hlsInfo.fileId : null,
      torrent_fname: hlsInfo?.fname || null,
      torrent_magnet: hlsInfo?.magnet || null,
    });
  };

  /* ── actions ── */
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setIsBuffering(true);
      video.play().then(() => setIsPlaying(true)).catch(() => { setIsPlaying(false); setIsBuffering(false); });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const hlsSeekTo = useCallback(async (absTime) => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (!video || !hls || !hlsInfo?.sessionId) return;
    const t = Math.max(0, absTime);
    hlsTimeOffsetRef.current = t;
    setCurrentTime(0);
    setIsBuffering(true);
    // Перезапускаємо FFmpeg з нової позиції
    await restartHlsSession(hlsInfo.sessionId, t);
    // Перезавантажуємо HLS.js з того самого URL
    hls.stopLoad();
    hls.loadSource(currentSource.url);
    hls.startLoad(0);
    video.currentTime = 0;
  }, [hlsInfo, currentSource?.url]);

  const seekBy = useCallback((delta) => {
    const video = videoRef.current;
    if (!video) return;
    if (isHls) {
      // Нативна перемотка всередині буфера — миттєво, без restart FFmpeg
      const newTime = Math.max(0, video.currentTime + delta);
      video.currentTime = newTime;
      setCurrentTime(newTime);
      return;
    }
    if (isTranscoded) {
      const abs = Math.max(0, transcodedOffset + video.currentTime + delta);
      setTranscodedOffset(Math.floor(abs));
      setCurrentTime(0);
      setIsBuffering(true);
      return;
    }
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration || 0);
    setCurrentTime(video.currentTime);
  }, [isHls, isTranscoded, transcodedOffset, hlsSeekTo]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !isMuted;
    video.muted = next;
    setIsMuted(next);
    if (!next && video.volume === 0) { video.volume = 0.5; setVolume(0.5); }
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const v = Number(e.target.value);
    video.volume = v; video.muted = v === 0;
    setVolume(v); setIsMuted(v === 0);
  };

  /* ── scrubbing ── */
  const handleScrubStart = () => { scrubAbsRef.current = null; setIsScrubbing(true); };

  const handleScrubChange = (e) => {
    const value = Number(e.target.value);
    if (isTranscoded || isHls) {
      // Зберігаємо в ref — надійніше ніж state для читання в handleScrubEnd
      scrubAbsRef.current = value;
    } else {
      setCurrentTime(value);
    }
  };

  const handleScrubEnd = () => {
    const video = videoRef.current;
    if (!video) return;
    setIsScrubbing(false);

    if (isHls) {
      const targetAbs = scrubAbsRef.current ?? displayedCurrentTime;
      scrubAbsRef.current = null;
      const currentAbs = hlsTimeOffsetRef.current + video.currentTime;
      const bufferedAhead = video.buffered.length > 0
        ? (video.buffered.end(video.buffered.length - 1) - video.currentTime)
        : 0;
      if (targetAbs >= currentAbs - 30 && targetAbs <= currentAbs + bufferedAhead) {
        video.currentTime = targetAbs - hlsTimeOffsetRef.current;
        setCurrentTime(video.currentTime);
      } else {
        hlsSeekTo(targetAbs);
      }
      if (movieDetails && userId) {
        saveProgress({
          user_id: userId, movie_id: movieDetails.id,
          position_seconds: Math.floor(targetAbs),
          season: selectedSeason ?? null, episode: selectedEpisode ?? null,
          duration: Math.floor(displayedDuration || 0),
          torrent_hash: hlsInfo?.hash || null,
          torrent_file_id: hlsInfo?.fileId != null ? hlsInfo.fileId : null,
          torrent_fname: hlsInfo?.fname || null,
          torrent_magnet: hlsInfo?.magnet || null,
        });
      }
      return;
    }

    if (isTranscoded) {
      const abs = Math.max(0, scrubAbsRef.current ?? displayedCurrentTime);
      scrubAbsRef.current = null;
      setTranscodedOffset(Math.floor(abs));
      setCurrentTime(0);
      setIsBuffering(true);
      if (movieDetails && userId) {
        saveProgress({
          user_id: userId, movie_id: movieDetails.id,
          position_seconds: Math.floor(abs),
          season: selectedSeason ?? null, episode: selectedEpisode ?? null,
          duration: Math.floor(displayedDuration || video.duration || 0),
        });
      }
      return;
    }

    video.currentTime = currentTime;
    if (!movieDetails || !userId) return;
    saveProgress({
      user_id: userId, movie_id: movieDetails.id,
      position_seconds: Math.floor(currentTime),
      season: selectedSeason ?? null, episode: selectedEpisode ?? null,
      duration: Math.floor(video.duration || duration || 0),
    });
  };

  /* ── quality ── */
  const handleChangeQuality = (quality) => {
    if (quality === currentQuality) return;
    const video = videoRef.current;
    if (!video) return;
    qualitySwitchRef.current = { time: video.currentTime, wasPlaying: !video.paused };
    setIsBuffering(true); setCurrentQuality(quality); setIsQualityMenuOpen(false);
  };

  useEffect(() => {
    if (!qualitySwitchRef.current) return;
    const video = videoRef.current;
    if (!video || !currentSource) return;
    const saved = qualitySwitchRef.current;
    const apply = () => {
      try {
        video.currentTime = saved.time || 0;
        if (saved.wasPlaying) video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      } finally { qualitySwitchRef.current = null; setIsBuffering(false); }
    };
    if (video.readyState >= 1) apply();
    else { video.addEventListener("loadedmetadata", apply, { once: true }); return () => video.removeEventListener("loadedmetadata", apply); }
  }, [currentSource]);

  /* ── fullscreen ── */
  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return;
    const isFS = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFS) {
      (root.requestFullscreen || root.webkitRequestFullscreen || (() => {})).call(root);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => { document.removeEventListener("fullscreenchange", handler); document.removeEventListener("webkitfullscreenchange", handler); };
  }, []);

  /* ── outside click menus ── */
  useEffect(() => {
    if (!isQualityMenuOpen && !isSubtitleMenuOpen) return;
    const handler = (e) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target)) setIsQualityMenuOpen(false);
      if (subtitleMenuRef.current && !subtitleMenuRef.current.contains(e.target)) setIsSubtitleMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isQualityMenuOpen, isSubtitleMenuOpen]);

  /* ── autosave ── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !movieDetails || !userId || !isPlaying) return;
    saveIntervalRef.current = setInterval(() => {
      if (video.paused) return;
      const absPosition = isHls
        ? Math.floor(hlsTimeOffsetRef.current + video.currentTime)
        : Math.floor(video.currentTime);
      saveProgress({
        user_id: userId, movie_id: movieDetails.id,
        position_seconds: absPosition,
        season: selectedSeason ?? null, episode: selectedEpisode ?? null,
        duration: Math.floor(displayedDuration || video.duration || 0),
        torrent_hash: hlsInfo?.hash || null,
        torrent_file_id: hlsInfo?.fileId != null ? hlsInfo.fileId : null,
        torrent_fname: hlsInfo?.fname || null,
        torrent_magnet: hlsInfo?.magnet || null,
      });
    }, 15000);
    return () => clearInterval(saveIntervalRef.current);
  }, [isPlaying, userId, movieDetails, selectedSeason, selectedEpisode, isHls, displayedDuration, hlsInfo]);

  /* ── subtitles ── */
  useEffect(() => { subtitleCuesRef.current = subtitleCues; }, [subtitleCues]);

  useEffect(() => {
    if (!currentSubtitle) { subtitleCuesRef.current = []; setSubtitleCues([]); setCurrentCueText(""); return; }
    const url = `${config.backend_url}/api/v1/rezka/subtitle_proxy?url=${encodeURIComponent(currentSubtitle.url)}`;
    fetch(url).then(r => r.text()).then(text => {
      const cues = parseSubtitles(text);
      subtitleCuesRef.current = cues; setSubtitleCues(cues);
    }).catch(() => {});
  }, [currentSubtitle]);

  /* ── progress hover ── */
  const handleProgressMouseMove = (e) => {
    const wrap = progressWrapRef.current;
    if (!wrap || !displayedDuration) return;
    const rect = wrap.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    wrap.style.setProperty("--hover-x", `${x}px`);
    setHoverTime((x / rect.width) * displayedDuration);
  };

  /* ── TV signal ── */
  useEffect(() => {
    document.body.dataset.tvPlayerActive = "true";
    return () => { delete document.body.dataset.tvPlayerActive; };
  }, []);

  /* ── hotkeys ── */
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      switch (e.code) {
        case "Space": case "Enter":
          e.preventDefault(); togglePlay(); showAndScheduleHide(); break;
        case "ArrowRight":
          e.preventDefault(); seekBy(10); showAndScheduleHide(); break;
        case "ArrowLeft":
          e.preventDefault(); seekBy(-10); showAndScheduleHide(); break;
        case "ArrowUp": case "ArrowDown":
          e.preventDefault(); showAndScheduleHide(); break;
        case "MediaPlayPause":
          e.preventDefault(); togglePlay(); break;
        case "MediaFastForward":
          e.preventDefault(); seekBy(30); break;
        case "MediaRewind":
          e.preventDefault(); seekBy(-30); break;
        case "KeyF":
          toggleFullscreen(); break;
        case "Escape":
          e.preventDefault();
          if (isQualityMenuOpen) setIsQualityMenuOpen(false);
          else if (isSubtitleMenuOpen) setIsSubtitleMenuOpen(false);
          else navigate(-1);
          break;
        default: break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isQualityMenuOpen, isSubtitleMenuOpen, togglePlay, seekBy, toggleFullscreen, showAndScheduleHide, navigate]);

  /* ── fallback ── */
  if (!movieDetails || !normalizedSources.length) {
    return (
      <div className="cp-fallback">
        <div className="cp-fallback__content">
          <p>Не вдалося завантажити відео</p>
          <button onClick={() => navigate(-1)} className="cp-fallback__btn">← Назад</button>
        </div>
      </div>
    );
  }

  const episodeLabel = selectedSeason != null && selectedEpisode != null
    ? ` · S${String(selectedSeason).padStart(2,"0")}E${String(selectedEpisode).padStart(2,"0")}` : "";

  return (
    <div
      className={`cp-root${showControls ? " cp-root--ui" : ""}`}
      ref={rootRef}
      onMouseMove={showAndScheduleHide}
      onTouchStart={showAndScheduleHide}
      onClick={(e) => { if (e.target === videoRef.current) togglePlay(); }}
    >
      {/* video */}
      <video
        ref={videoRef}
        className="cp-video"
        src={effectiveSrc}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleDurationChange}
        onLoadedData={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onTimeUpdate={handleTimeUpdate}
        onPause={handlePause}
        playsInline
      />

      {/* scrims */}
      <div className="cp-scrim cp-scrim--top" />
      <div className="cp-scrim cp-scrim--bottom" />

      {/* buffering */}
      {isBuffering && (
        <div className="cp-spinner-wrap">
          <div className="cp-spinner" />
        </div>
      )}

      {/* subtitles */}
      {currentCueText && (
        <div className={`cp-subs${showControls ? " cp-subs--up" : ""}`}>
          {currentCueText.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}
        </div>
      )}

      {/* ── UI overlay ── */}
      <div className={`cp-ui${showControls ? " cp-ui--visible" : ""}`}>

        {/* TOP BAR */}
        <div className="cp-top">
          <button className="cp-back" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <div className="cp-top__meta">
            <div className="cp-top__title">{movieDetails.title}{episodeLabel}</div>
            {currentQuality && (
              <div className="cp-top__quality">{String(currentQuality).replace("_Ultra", "")}</div>
            )}
          </div>
        </div>

        {/* BOTTOM */}
        <div className="cp-bottom">

          {/* progress */}
          <div
            className="cp-progress-wrap"
            ref={progressWrapRef}
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={() => setHoverTime(null)}
          >
            {hoverTime !== null && (
              <div className="cp-hover-time">{formatTime(hoverTime)}</div>
            )}
            <div className="cp-track">
              <div className="cp-track__fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <input
              type="range"
              className="cp-scrubber"
              min={0}
              max={displayedDuration || 0}
              step={1}
              value={displayedCurrentTime}
              onMouseDown={handleScrubStart}
              onTouchStart={handleScrubStart}
              onChange={handleScrubChange}
              onMouseUp={handleScrubEnd}
              onTouchEnd={handleScrubEnd}
            />
          </div>

          {/* controls */}
          <div className="cp-controls">
            {/* left */}
            <div className="cp-controls__left">
              <button className="cp-btn" onClick={togglePlay} aria-label="Play/Pause">
                {isPlaying ? <Pause size={20} strokeWidth={2} /> : <Play size={20} strokeWidth={2} />}
              </button>
              <button className="cp-btn" onClick={() => seekBy(-10)} aria-label="-10s">
                <RotateCcw size={18} strokeWidth={2} />
                <span className="cp-btn__label">10</span>
              </button>
              <button className="cp-btn" onClick={() => seekBy(10)} aria-label="+10s">
                <RotateCw size={18} strokeWidth={2} />
                <span className="cp-btn__label">10</span>
              </button>
              <button className="cp-btn" onClick={toggleMute} aria-label="Mute">
                {isMuted ? <VolumeX size={18} strokeWidth={2} /> : <Volume2 size={18} strokeWidth={2} />}
              </button>
              <div className="cp-volume">
                <input
                  type="range"
                  min={0} max={1} step={0.02}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="cp-volume__slider"
                  style={{ "--vol": `${volumePercent}%` }}
                />
              </div>
              <span className="cp-time">
                {formatTime(displayedCurrentTime)} / {formatTime(displayedDuration)}
              </span>
            </div>

            {/* right */}
            <div className="cp-controls__right">
              {subtitles.length > 0 && (
                <div ref={subtitleMenuRef} className="cp-menu-wrap">
                  <button
                    className={`cp-btn${currentSubtitle ? " cp-btn--active" : ""}`}
                    onClick={() => setIsSubtitleMenuOpen(p => !p)}
                    aria-label="Subtitles"
                  >
                    <Captions size={18} strokeWidth={2} />
                  </button>
                  {isSubtitleMenuOpen && (
                    <div className="cp-menu">
                      <div className="cp-menu__title">Субтитри</div>
                      <button
                        className={`cp-menu__item${!currentSubtitle ? " cp-menu__item--on" : ""}`}
                        onClick={() => { setCurrentSubtitle(null); setIsSubtitleMenuOpen(false); }}
                      >Вимкнено</button>
                      {subtitles.map(sub => (
                        <button
                          key={sub.lang}
                          className={`cp-menu__item${currentSubtitle?.lang === sub.lang ? " cp-menu__item--on" : ""}`}
                          onClick={() => { setCurrentSubtitle(sub); setIsSubtitleMenuOpen(false); }}
                        >{sub.lang}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {normalizedSources.length > 1 && (
                <div ref={qualityMenuRef} className="cp-menu-wrap">
                  <button
                    className="cp-btn cp-btn--text"
                    onClick={() => setIsQualityMenuOpen(p => !p)}
                    aria-label="Quality"
                  >
                    <Settings size={16} strokeWidth={2} />
                    <span>{String(currentQuality || "").replace("_Ultra", "")}</span>
                  </button>
                  {isQualityMenuOpen && (
                    <div className="cp-menu">
                      <div className="cp-menu__title">Якість</div>
                      {normalizedSources.slice().reverse().map(s => (
                        <button
                          key={s.quality}
                          className={`cp-menu__item${s.quality === currentQuality ? " cp-menu__item--on" : ""}`}
                          onClick={() => handleChangeQuality(s.quality)}
                        >{s.quality.replace("_Ultra", "")}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button className="cp-btn" onClick={toggleFullscreen} aria-label="Fullscreen">
                {isFullscreen ? <Minimize size={18} strokeWidth={2} /> : <Maximize size={18} strokeWidth={2} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
