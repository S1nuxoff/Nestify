// src/components/layout/MobileBottomNav.jsx
import React, { useMemo, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, Bookmark, User, Play, Pause, Square } from "lucide-react";
import usePlayerStatus from "../../hooks/usePlayerStatus";
import nestifyPlayerClient from "../../api/ws/nestifyPlayerClient";
import { toRezkaSlug } from "../../core/rezkaLink";
import "../../styles/MobileBottomNav.css";

const HomeFilled = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.55 2.533a2.25 2.25 0 0 1 2.9 0l6.75 5.695c.508.427.8 1.056.8 1.717V19.75A2.25 2.25 0 0 1 18.75 22H15a.75.75 0 0 1-.75-.75v-4.5a2.25 2.25 0 0 0-4.5 0v4.5A.75.75 0 0 1 9 22H5.25A2.25 2.25 0 0 1 3 19.75V9.945c0-.661.292-1.29.8-1.717l6.75-5.695Z" />
  </svg>
);
const SearchFilled = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M10.5 3a7.5 7.5 0 1 0 4.55 13.47l3.74 3.74a1 1 0 0 0 1.42-1.42l-3.74-3.74A7.5 7.5 0 0 0 10.5 3Zm-5.5 7.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" />
  </svg>
);
const BookmarkFilled = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 2a2 2 0 0 0-2 2v17.17a1 1 0 0 0 1.62.78L12 17.2l6.38 4.75A1 1 0 0 0 20 21.17V4a2 2 0 0 0-2-2H6Z" />
  </svg>
);

const FILLED = { "/": HomeFilled, "/search": SearchFilled, "/liked": BookmarkFilled };
const OUTLINE = { "/": Home, "/search": Search, "/liked": Bookmark };

const RING = 46;
const R = RING / 2 - 2.5;
const C = 2 * Math.PI * R;

const formatTime = (sec) => {
  const total = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

function MiniPlayerBar() {
  const { status } = usePlayerStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const state = status?.state || (status?.is_playing ? "playing" : "paused");
  const isActive = !!(status && (status.link || status.title) && state !== "stopped" && state !== "idle");
  const isPlaying = !!(status && (status.is_playing || state === "playing"));

  const currentSec = Math.floor((status?.position_ms || 0) / 1000);
  const durationSec = Math.max(0, Math.floor((status?.duration_ms || 0) / 1000));

  const progressPercent = useMemo(() => {
    if (!durationSec) return 0;
    return Math.min(100, (currentSec / durationSec) * 100);
  }, [currentSec, durationSec]);

  const dashOffset = C * (1 - progressPercent / 100);

  const currentSlug = useMemo(() => {
    if (!status?.link) return null;
    try { return toRezkaSlug(status.link); } catch { return null; }
  }, [status?.link]);

  useEffect(() => {
    document.body.classList.toggle("has-mini-player", isActive);
    return () => document.body.classList.remove("has-mini-player");
  }, [isActive]);

  const handlePlayPause = useCallback((e) => {
    e.stopPropagation();
    nestifyPlayerClient.playPause();
  }, []);

  const handleStop = useCallback((e) => {
    e.stopPropagation();
    nestifyPlayerClient.stop();
  }, []);

  const handleClick = useCallback(() => {
    if (currentSlug) navigate(`/movie/${currentSlug}`);
  }, [currentSlug, navigate]);

  if (!isActive) return null;

  const title = status?.title || "Без назви";
  const image = status?.image;

  return (
    <div className="mbn-mini-player" onClick={handleClick} role="button" tabIndex={0}>
      {/* Ring + poster */}
      <div className="mbn-mini-ring">
        <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
          <circle cx={RING/2} cy={RING/2} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.2" />
          <circle cx={RING/2} cy={RING/2} r={R} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.2"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 300ms ease" }} />
        </svg>
        <div className="mbn-mini-thumb" style={image ? { backgroundImage: `url(${image})` } : undefined} />
      </div>

      {/* Text */}
      <div className="mbn-mini-content">
        <span className="mbn-mini-title">{title}</span>
        {durationSec > 0 && (
          <span className="mbn-mini-time">{formatTime(currentSec)} / {formatTime(durationSec)}</span>
        )}
      </div>

      {/* Controls */}
      <button className="mbn-mini-btn" onClick={handlePlayPause} type="button" aria-label={isPlaying ? "Pause" : "Play"}>
        {isPlaying
          ? <Pause size={20} fill="currentColor" strokeWidth={0} />
          : <Play size={20} fill="currentColor" strokeWidth={0} />}
      </button>
      <button className="mbn-mini-btn mbn-mini-btn--stop" onClick={handleStop} type="button" aria-label="Stop">
        <Square size={16} fill="currentColor" strokeWidth={0} />
      </button>
    </div>
  );
}

export default function MobileBottomNav({ currentAvatar }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const tabs = [
    { path: "/", label: "Головна" },
    { path: "/search", label: "Пошук" },
    { path: "/liked", label: "Збережені" },
  ];

  return (
    <div className="mobile-bottom-nav-wrap">
      <MiniPlayerBar />
      <nav className="mobile-bottom-nav">
        {tabs.map(({ path, label }) => {
          const active = isActive(path);
          const Icon = active ? FILLED[path] : OUTLINE[path];
          return (
            <button key={path} type="button"
              className={`mbn-tab${active ? " mbn-tab--active" : ""}`}
              onClick={() => navigate(path)} aria-label={label}>
              <Icon size={26} {...(!active && { strokeWidth: 1.6 })} />
              <span className="mbn-tab__label">{label}</span>
            </button>
          );
        })}
        <button type="button"
          className={`mbn-tab mbn-tab--avatar${isActive("/account") ? " mbn-tab--active" : ""}`}
          onClick={() => navigate("/account")} aria-label="Профіль">
          {currentAvatar
            ? <img src={currentAvatar} alt="" className="mbn-avatar-img" />
            : <div className="mbn-avatar-placeholder"><User size={24} strokeWidth={1.8} /></div>}
          <span className="mbn-tab__label">Профіль</span>
        </button>
      </nav>
    </div>
  );
}
