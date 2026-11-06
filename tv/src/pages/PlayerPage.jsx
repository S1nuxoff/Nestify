import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import config from "../core/config";
import { stopHlsSession, restartHlsSession } from "../api/v3";
import {
  BackIcon, PlayIcon, PauseIcon, Replay10Icon, Forward10Icon, VolumeIcon, MutedIcon, NextIcon,
  EpisodesIcon, AudioSubtitlesIcon, QualityIcon, FullscreenIcon, ExitFullscreenIcon, CloseIcon, CheckIcon,
} from "../components/ui/PlayerIcons";

import "../styles/VideoPlayer.css";
import { getProgress, saveProgress } from "../api/hdrezka/progressApi";
import { getTvSeason, tmdbImg } from "../api/tmdb";
import { preparePlayback } from "../core/playback";
import { DONE_RATIO, nextEpisode } from "../core/playbackPlan";

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

const UP_NEXT_SECONDS = 30;

/* ─── component ────────────────────────────────────────────── */
function PlayerView() {
  const location = useLocation();
  const { state } = location;
  const { selectedEpisode, selectedSeason, movieDetails, movie_url, sources, subtitles = [], fileDuration = null, hlsInfo = null, plugin = null, startAt = null } = state ?? {};
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
  const [currentSubtitle, setCurrentSubtitle]     = useState(null);
  const [subtitleCues, setSubtitleCues]   = useState([]);
  const [currentCueText, setCurrentCueText] = useState("");
  const [hoverTime, setHoverTime]         = useState(null);
  const [panel, setPanel]                 = useState(null); // audio | episodes | quality
  const [upNextDismissed, setUpNextDismissed] = useState(false);
  const [seasonDetails, setSeasonDetails] = useState({}); // номер сезону → серії з TMDB
  const [isSeasonListOpen, setIsSeasonListOpen] = useState(false);
  const [expandedEpisode, setExpandedEpisode] = useState(null);
  const currentEpisodeRef = useRef(null);
  const [bufferedEnd, setBufferedEnd]     = useState(0);
  const [isTouch] = useState(() => window.matchMedia?.("(hover: none)").matches ?? false);
  const [menuSeason, setMenuSeason]       = useState(selectedSeason);
  const [switchError, setSwitchError]     = useState(null);
  const switchingRef   = useRef(false);

  /* ── derived ── */
  useEffect(() => {
    if (!normalizedSources.length || currentQuality) return;
    const kept = normalizedSources.find(s => s.quality === plugin?.quality);
    setCurrentQuality((kept || normalizedSources[normalizedSources.length - 1]).quality);
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
  const panelOpenRef = useRef(false);
  useEffect(() => {
    panelOpenRef.current = Boolean(panel);
    if (panel) { clearTimeout(hideTimerRef.current); setShowControls(true); }
  }, [panel]);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    if (panelOpenRef.current) return;
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
  }, [isPlaying, panel, scheduleHide]);

  /* ── getProgress ── */
  useEffect(() => {
    if (startAt != null) { setStartPos(startAt); return; }
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
  }, [userId, movieDetails, selectedSeason, selectedEpisode, startAt]);

  /* ── apply startPos + autoplay ── */
  useEffect(() => {
    const video = videoRef.current;
    // HLS: autoplay + seek handled in MANIFEST_PARSED (FFmpeg starts at correct offset)
    if (!video || startPos === null || !currentSource || isHls) return;
    const apply = () => {
      try {
        // Досмотрене вмикаємо спочатку, а не за хвилину до кінця.
        const finished = video.duration > 0 && startPos / video.duration >= DONE_RATIO;
        if (startPos > 0 && !finished) video.currentTime = startPos;
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

  const handleBufferProgress = () => {
    const video = videoRef.current;
    if (!video?.buffered?.length) return;
    const offset = isHls ? hlsTimeOffsetRef.current : (isTranscoded ? transcodedOffset : 0);
    for (let i = video.buffered.length - 1; i >= 0; i--) {
      if (video.buffered.start(i) <= video.currentTime) {
        setBufferedEnd(offset + video.buffered.end(i));
        return;
      }
    }
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
    setIsBuffering(true); setCurrentQuality(quality); setPanel(null);
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
    // Субтитри з плагінів уже йдуть через наш сервер.
    const url = currentSubtitle.url.includes("/api/v4/play/")
      ? currentSubtitle.url
      : `${config.backend_url}/api/v1/rezka/subtitle_proxy?url=${encodeURIComponent(currentSubtitle.url)}`;
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
          if (panel) setPanel(null);
          else navigate(-1);
          break;
        default: break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panel, togglePlay, seekBy, toggleFullscreen, showAndScheduleHide, navigate]);

  /* ── plugin playback: voices, episodes, next episode ── */
  const upNext = plugin && selectedSeason != null
    ? nextEpisode(plugin.seasons, selectedSeason, selectedEpisode)
    : null;
  const menuEpisodes = plugin?.seasons?.find(s => s.season_number === Number(menuSeason))?.episode_count || 0;

  const switchTo = useCallback(async ({ season = selectedSeason, episode = selectedEpisode, voice = plugin?.voice, explicitVoice = false, at = null }) => {
    if (!plugin || switchingRef.current) return;
    switchingRef.current = true;
    setSwitchError(null);
    setPanel(null);
    setIsBuffering(true);
    try {
      const next = await preparePlayback({
        query: plugin.query, movieId: plugin.movieId, userId, seasons: plugin.seasons,
        season, episode, voice, explicitVoice, startAt: at,
        quality: currentQuality, subtitleLang: currentSubtitle?.lang || null,
      });
      if (next) {
        navigate(location.pathname, { replace: true, state: { movieDetails, ...next } });
        return;
      }
      setSwitchError("Цю серію зараз не вдалося відкрити");
    } catch {
      setSwitchError("Цю серію зараз не вдалося відкрити");
    }
    switchingRef.current = false;
    setIsBuffering(false);
  }, [plugin, selectedSeason, selectedEpisode, userId, currentQuality, currentSubtitle, movieDetails, location.pathname, navigate]);

  /* ── episode list ── */
  const tmdbId = plugin?.query?.tmdb_id;
  const shownEpisodes = seasonDetails[Number(menuSeason)];

  useEffect(() => {
    if (panel !== "episodes" || !tmdbId || !menuSeason || shownEpisodes) return;
    let cancelled = false;
    getTvSeason(tmdbId, menuSeason)
      .then((data) => {
        if (!cancelled) setSeasonDetails(prev => ({ ...prev, [Number(menuSeason)]: data.episodes || [] }));
      })
      // Без TMDB залишається список із номерами.
      .catch(() => {
        if (!cancelled) setSeasonDetails(prev => ({ ...prev, [Number(menuSeason)]: [] }));
      });
    return () => { cancelled = true; };
  }, [panel, tmdbId, menuSeason, shownEpisodes]);

  useEffect(() => {
    if (panel === "episodes" && !isSeasonListOpen) currentEpisodeRef.current?.scrollIntoView({ block: "center" });
  }, [panel, shownEpisodes, isSeasonListOpen]);

  const saveCurrentPosition = (position) => {
    const video = videoRef.current;
    if (!video || !movieDetails || !userId) return;
    saveProgress({
      user_id: userId, movie_id: movieDetails.id,
      position_seconds: Math.floor(position),
      season: selectedSeason ?? null, episode: selectedEpisode ?? null,
      duration: Math.floor(video.duration || 0),
    });
  };

  const goToEpisode = (target) => {
    saveCurrentPosition(videoRef.current?.currentTime || 0);
    switchTo(target);
  };

  const handleEnded = () => {
    if (!plugin) return;
    saveCurrentPosition(videoRef.current?.duration || 0);
    if (upNext) switchTo(upNext);
  };

  useEffect(() => {
    if (!plugin?.subtitleLang) return;
    const kept = subtitles.find(s => s.lang === plugin.subtitleLang);
    if (kept) setCurrentSubtitle(kept);
  }, []);

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
    ? `Сезон ${selectedSeason}, Серія ${selectedEpisode}` : "";
  const subtitleLine = [episodeLabel, plugin?.voice].filter(Boolean).join(" · ");
  const hasAudioPanel = plugin?.voices?.length > 1 || subtitles.length > 0;
  const hasEpisodes = plugin?.seasons?.length > 0 && selectedSeason != null;
  const remaining = Math.max(0, displayedDuration - displayedCurrentTime);
  const showUpNext = upNext && !upNextDismissed && displayedDuration > 0 && remaining <= UP_NEXT_SECONDS;
  const bufferedPercent = displayedDuration > 0 ? Math.min(100, (bufferedEnd / displayedDuration) * 100) : 0;
  const closePanel = () => setPanel(null);

  return (
    <div
      className={`cp-root${showControls ? " cp-root--ui" : ""}`}
      ref={rootRef}
      onMouseMove={showAndScheduleHide}
      onClick={(e) => {
        if (e.target !== videoRef.current) return;
        // На сенсорному екрані дотик лише показує чи ховає кнопки, а не ставить на паузу.
        if (isTouch) setShowControls(v => !v);
        else togglePlay();
      }}
    >
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
        onProgress={handleBufferProgress}
        onPause={handlePause}
        onEnded={handleEnded}
        playsInline
      />

      <div className="cp-scrim cp-scrim--top" />
      <div className="cp-scrim cp-scrim--bottom" />

      {isBuffering && (
        <div className="cp-spinner-wrap cp-spinner-wrap--over-play">
          <div className="cp-spinner" />
        </div>
      )}

      {currentCueText && (
        <div className={`cp-subs${showControls ? " cp-subs--up" : ""}`}>
          {currentCueText.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}
        </div>
      )}

      <div className={`cp-ui${showControls ? " cp-ui--visible" : ""}`}>
        <div className="cp-top">
          <button className="cp-back" onClick={() => navigate(-1)} aria-label="Назад">
            <BackIcon size={28} />
          </button>
          <div className="cp-top__meta">
            <div className="cp-top__title">{movieDetails.title}</div>
            {subtitleLine && <div className="cp-top__sub">{subtitleLine}</div>}
            {switchError && <div className="cp-top__error">{switchError}</div>}
          </div>
          <span />
        </div>

        <div className="cp-center">
          <button className="cp-center__btn" onClick={() => seekBy(-10)} aria-label="Назад на 10 секунд">
            <Replay10Icon />
          </button>
          <button className={`cp-center__btn cp-center__play${isBuffering ? " cp-center__play--loading" : ""}`} onClick={togglePlay} aria-label={isPlaying ? "Пауза" : "Відтворити"}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="cp-center__btn" onClick={() => seekBy(10)} aria-label="Вперед на 10 секунд">
            <Forward10Icon />
          </button>
        </div>

        <div className="cp-bottom">
          <div className="cp-progress-row">
            <span className="cp-time">{formatTime(displayedCurrentTime)}</span>
            <div
              className="cp-progress-wrap"
              ref={progressWrapRef}
              onMouseMove={handleProgressMouseMove}
              onMouseLeave={() => setHoverTime(null)}
            >
              {hoverTime !== null && <div className="cp-hover-time">{formatTime(hoverTime)}</div>}
              <div className="cp-track">
                <div className="cp-track__buffer" style={{ width: `${bufferedPercent}%` }} />
                <div className="cp-track__fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="cp-thumb" style={{ left: `${progressPercent}%` }} />
              <input
                type="range"
                className="cp-scrubber"
                aria-label="Перемотка"
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
            <span className="cp-time cp-time--end">-{formatTime(remaining)}</span>
          </div>

          <div className="cp-controls">
            <div className="cp-controls__left">
              <div className="cp-volume-group">
                <button className="cp-btn" onClick={toggleMute} aria-label={isMuted ? "Увімкнути звук" : "Вимкнути звук"}>
                  {isMuted ? <MutedIcon /> : <VolumeIcon />}
                </button>
                <div className="cp-volume">
                  <input
                    type="range"
                    aria-label="Гучність"
                    min={0} max={1} step={0.02}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="cp-volume__slider"
                    style={{ "--vol": `${volumePercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="cp-controls__right">
              {upNext && (
                <button className="cp-btn" onClick={() => goToEpisode(upNext)} aria-label="Наступна серія">
                  <NextIcon size={22} />
                  <span className="cp-btn__text">Наступна серія</span>
                </button>
              )}
              {hasEpisodes && (
                <button className={`cp-btn${panel === "episodes" ? " cp-btn--on" : ""}`} onClick={() => setPanel(p => (p === "episodes" ? null : "episodes"))} aria-label="Серії">
                  <EpisodesIcon />
                  <span className="cp-btn__text">Серії</span>
                </button>
              )}
              {hasAudioPanel && (
                <button className={`cp-btn${panel === "audio" ? " cp-btn--on" : ""}`} onClick={() => setPanel(p => (p === "audio" ? null : "audio"))} aria-label="Озвучка й субтитри">
                  <AudioSubtitlesIcon />
                  <span className="cp-btn__text">Озвучка й субтитри</span>
                </button>
              )}
              {normalizedSources.length > 1 && (
                <button className={`cp-btn${panel === "quality" ? " cp-btn--on" : ""}`} onClick={() => setPanel(p => (p === "quality" ? null : "quality"))} aria-label="Якість">
                  <QualityIcon />
                  <span className="cp-btn__text">{String(currentQuality || "").replace("_Ultra", "")}</span>
                </button>
              )}
              <button className="cp-btn" onClick={toggleFullscreen} aria-label={isFullscreen ? "Вийти з повного екрана" : "На весь екран"}>
                {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showUpNext && !panel && (
        <div className="cp-upnext">
          <div>
            <div className="cp-upnext__label">Наступна серія</div>
            <div className="cp-upnext__title">Сезон {upNext.season}, Серія {upNext.episode}</div>
          </div>
          <div className="cp-upnext__actions">
            <button className="cp-upnext__play" onClick={() => goToEpisode(upNext)}>
              <PlayIcon size={16} /> Дивитися
            </button>
            <button className="cp-upnext__dismiss" onClick={() => setUpNextDismissed(true)}>Сховати</button>
          </div>
        </div>
      )}

      {panel && <div className="cp-backdrop" onClick={closePanel} />}

      {panel === "audio" && (
        <aside className="cp-panel cp-panel--audio" aria-label="Озвучка й субтитри">
          <button className="cp-panel__close" onClick={closePanel} aria-label="Закрити"><CloseIcon size={24} /></button>
          <div className="cp-panel__columns">
            {plugin?.voices?.length > 1 && (
              <div className="cp-panel__column">
                <h3 className="cp-panel__heading">Озвучка</h3>
                {plugin.voices.map(name => (
                  <button
                    key={name}
                    className={`cp-option${name === plugin.voice ? " cp-option--on" : ""}`}
                    onClick={() => name !== plugin.voice && switchTo({ voice: name, explicitVoice: true, at: videoRef.current?.currentTime || 0 })}
                  >
                    <span className="cp-option__check">{name === plugin.voice && <CheckIcon size={20} />}</span>
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="cp-panel__column">
              <h3 className="cp-panel__heading">Субтитри</h3>
              <button className={`cp-option${!currentSubtitle ? " cp-option--on" : ""}`} onClick={() => setCurrentSubtitle(null)}>
                <span className="cp-option__check">{!currentSubtitle && <CheckIcon size={20} />}</span>
                Вимкнено
              </button>
              {subtitles.map(sub => (
                <button
                  key={sub.lang}
                  className={`cp-option${currentSubtitle?.lang === sub.lang ? " cp-option--on" : ""}`}
                  onClick={() => setCurrentSubtitle(sub)}
                >
                  <span className="cp-option__check">{currentSubtitle?.lang === sub.lang && <CheckIcon size={20} />}</span>
                  {sub.lang}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {panel === "episodes" && (
        <aside className="cp-panel cp-panel--episodes" aria-label="Серії">
          <button className="cp-panel__close" onClick={closePanel} aria-label="Закрити"><CloseIcon size={24} /></button>
          {isSeasonListOpen ? (
            <>
              <h3 className="cp-panel__heading cp-panel__heading--bar">Сезони</h3>
              <div className="cp-panel__body">
                {plugin.seasons.map(s => (
                  <button
                    key={s.season_number}
                    className={`cp-option${s.season_number === Number(menuSeason) ? " cp-option--on" : ""}`}
                    onClick={() => { setMenuSeason(s.season_number); setExpandedEpisode(null); setIsSeasonListOpen(false); }}
                  >
                    <span className="cp-option__check">{s.season_number === Number(menuSeason) && <CheckIcon size={20} />}</span>
                    Сезон {s.season_number}
                    <span className="cp-option__note">{s.episode_count} сер.</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button className="cp-panel__heading cp-panel__heading--bar cp-panel__back" onClick={() => setIsSeasonListOpen(true)}>
                <BackIcon size={22} /> Сезон {menuSeason}
              </button>
              <div className="cp-panel__body">
                {Array.from({ length: menuEpisodes }, (_, i) => i + 1).map(n => {
                  const episode = shownEpisodes?.find(e => e.episode_number === n);
                  const isCurrent = Number(menuSeason) === Number(selectedSeason) && n === Number(selectedEpisode);
                  const isOpen = expandedEpisode === n || (expandedEpisode === null && isCurrent);
                  const play = () => (isCurrent ? closePanel() : goToEpisode({ season: Number(menuSeason), episode: n }));
                  return (
                    <div key={n} ref={isCurrent ? currentEpisodeRef : null} className="cp-ep">
                      {isOpen ? (
                        <button className="cp-ep__open" onClick={play} aria-label={`Дивитися серію ${n}`}>
                          <span className="cp-ep__number cp-ep__number--on">{n}</span>
                          <span className="cp-ep__still">
                            {episode?.still_path && <img src={tmdbImg(episode.still_path, "w300")} alt="" loading="lazy" />}
                            <span className="cp-ep__play"><PlayIcon size={26} /></span>
                          </span>
                          <span className="cp-ep__text">
                            <span className="cp-ep__title cp-ep__title--open">{episode?.name || `Серія ${n}`}</span>
                            {episode?.overview && <span className="cp-ep__overview">{episode.overview}</span>}
                            {episode?.runtime ? <span className="cp-ep__runtime">{episode.runtime} хв</span> : null}
                          </span>
                        </button>
                      ) : (
                        <button className="cp-ep__row" onClick={() => setExpandedEpisode(n)}>
                          <span className="cp-ep__number">{n}</span>
                          <span className="cp-ep__title">{episode?.name || `Серія ${n}`}</span>
                          {isCurrent && <span className="cp-ep__marker" aria-label="Зараз" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>
      )}

      {panel === "quality" && (
        <aside className="cp-panel cp-panel--quality" aria-label="Якість">
          <button className="cp-panel__close" onClick={closePanel} aria-label="Закрити"><CloseIcon size={24} /></button>
          <h3 className="cp-panel__heading cp-panel__heading--bar">Якість</h3>
          <div className="cp-panel__body">
            {normalizedSources.slice().reverse().map(s => (
              <button
                key={s.quality}
                className={`cp-option${s.quality === currentQuality ? " cp-option--on" : ""}`}
                onClick={() => handleChangeQuality(s.quality)}
              >
                <span className="cp-option__check">{s.quality === currentQuality && <CheckIcon size={20} />}</span>
                {s.quality.replace("_Ultra", "")}
              </button>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

// Новий запуск (серія чи озвучка) починається з чистого стану плеєра.
export default function PlayerPage() {
  const location = useLocation();
  return <PlayerView key={location.key} />;
}
