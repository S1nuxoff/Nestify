import React, { useEffect, useRef, useState } from "react";
import logoUrl from "/logo.svg";
import { useNavigate, useLocation } from "react-router-dom";
import { androidLogoutAccount, isAndroidBridge } from "../../api/AndroidBridge";
import {
  Home, Film, Tv2, Search, History, Heart,
  BookOpen, Clapperboard, LogOut, Users,
} from "lucide-react";
import config from "../../core/config";
import { clearAuthSession, getCurrentProfile } from "../../core/session";

const SIDEBAR_W  = 264;
const GAP        = 14;  // отступ от краёв экрана

const NAV_ITEMS = [
  { type: "nav", icon: Home,         label: "Головна",     path: "/" },
 /*  { type: "nav", icon: Film,         label: "Фільми",      path: "/catalog/movies" },
  { type: "nav", icon: Tv2,          label: "Серіали",     path: "/catalog/series" },
  { type: "nav", icon: Clapperboard, label: "Аніме",       path: "/catalog/anime" },
  { type: "nav", icon: BookOpen,     label: "Мультфільми", path: "/catalog/animation" }, */
  { type: "nav", icon: Search,       label: "Пошук",       path: "/search" },
 /*  { type: "nav", icon: History,      label: "Історія",     path: "/history" },
  { type: "nav", icon: Heart,        label: "Вибране",     path: "/liked" }, */
];

const PROFILE_IDX = NAV_ITEMS.length;

const SUB_ITEMS = [
  { type: "action", icon: Users,  label: "Змінити профіль", action: "profiles" },
  { type: "action", icon: LogOut, label: "Вийти",           action: "logout",  danger: true },
];

const BACK_CODES  = new Set([8, 27, 461, 10009, 88]);
const ENTER_CODES = new Set([13, 29443, 65385, 117]);
const UP_CODES    = new Set([38, 29460]);
const DOWN_CODES  = new Set([40, 29461]);
const RIGHT_CODES = new Set([39, 5]);

function matchNavIndex(pathname) {
  let best = 0;
  NAV_ITEMS.forEach((item, i) => {
    if (item.path === "/") { if (pathname === "/") best = i; }
    else if (pathname.startsWith(item.path)) {
      if (item.path.length > (NAV_ITEMS[best]?.path?.length ?? 0)) best = i;
    }
  });
  return best;
}

export default function TvSidebar() {
  const [visible,   setVisible]   = useState(false);
  const [sliding,   setSliding]   = useState(false); // true = panel is at translateX(0)
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate    = useNavigate();
  const location    = useLocation();
  const itemRefs    = useRef([]);
  const savedFocus  = useRef(null);
  const profile     = getCurrentProfile();
  const avatarUrl   = profile?.avatar_url ? `${config.backend_url}${profile.avatar_url}` : null;

  const profileExpanded = activeIdx >= PROFILE_IDX;
  const totalItems = profileExpanded
    ? PROFILE_IDX + 1 + SUB_ITEMS.length
    : PROFILE_IDX + 1;

  // Listen for open event
  useEffect(() => {
    const onOpen = () => {
      savedFocus.current = document.activeElement;
      setActiveIdx(matchNavIndex(location.pathname));
      setVisible(true);
      // rAF × 2 so the browser paints the initial translateX(-100%) before transition starts
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setSliding(true);
          document.body.classList.add("sidebar-open");
        })
      );
    };
    window.addEventListener("tv:open-sidebar", onOpen);
    return () => window.removeEventListener("tv:open-sidebar", onOpen);
  }, [location.pathname]);

  // Focus active item once panel is in
  useEffect(() => {
    if (sliding) {
      setTimeout(() => itemRefs.current[activeIdx]?.focus({ preventScroll: true }), 80);
    }
  }, [sliding, activeIdx]);

  // Keyboard capture — blocks everything behind
  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => {
      const code = e.keyCode || e.which;
      e.stopImmediatePropagation();

      if (UP_CODES.has(code)) { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); return; }
      if (DOWN_CODES.has(code)) { e.preventDefault(); setActiveIdx((i) => Math.min(totalItems - 1, i + 1)); return; }
      if (RIGHT_CODES.has(code) || BACK_CODES.has(code)) { e.preventDefault(); closePanel(); return; }
      if (ENTER_CODES.has(code)) { e.preventDefault(); handleSelect(activeIdx); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [visible, activeIdx, totalItems]);

  const closePanel = () => {
    setSliding(false);
    document.body.classList.remove("sidebar-open");
    setTimeout(() => {
      setVisible(false);
      savedFocus.current?.focus({ preventScroll: true });
    }, 280);
  };

  const handleSelect = (idx) => {
    if (idx < PROFILE_IDX) {
      navigate(NAV_ITEMS[idx].path);
      closePanel();
    } else if (idx === PROFILE_IDX) {
      // profile header — already expanded by focus
    } else {
      const sub = SUB_ITEMS[idx - PROFILE_IDX - 1];
      if (sub?.action === "profiles") { navigate("/manage-profiles"); closePanel(); }
      else if (sub?.action === "logout") {
        Promise.resolve()
          .then(() => (isAndroidBridge() ? androidLogoutAccount() : null))
          .finally(() => {
            clearAuthSession();
            navigate("/auth/login");
            window.location.reload();
          });
      }
    }
  };

  if (!visible) return null;

  return (
    <nav
      style={{
        position: "fixed",
        top: GAP, left: GAP, bottom: GAP,
        width: SIDEBAR_W,
        borderRadius: 18,
        zIndex: 10000011,
        background: "linear-gradient(180deg, #131313 0%, #181818 100%)",
        boxShadow: sliding ? "4px 0 48px rgba(0,0,0,0.65)" : "none",
        display: "flex", flexDirection: "column",
        transform: sliding ? "translateX(0)" : `translateX(calc(-100% - ${GAP}px))`,
        transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1), box-shadow 0.26s ease",
        pointerEvents: "auto",
        overflowY: "auto", overflowX: "hidden",
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: "28px 20px 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <img src={logoUrl} alt="Nestify" style={{ height: 38, width: "auto" }} />
      </div>

      {/* ── Nav items ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, paddingTop: 4 }}>
        {NAV_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const isFocused = activeIdx === idx;
          const isCurrent = item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path);
          return (
            <NavBtn
              key={item.path}
              ref_={(el) => (itemRefs.current[idx] = el)}
              icon={<Icon size={19} strokeWidth={isCurrent ? 2.5 : 1.8} />}
              label={item.label}
              isFocused={isFocused}
              isCurrent={isCurrent}
              onClick={() => { navigate(item.path); closePanel(); }}
            />
          );
        })}
      </div>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

      {/* ── Profile item ──────────────────────────────────────────────── */}
      <button
        ref={(el) => (itemRefs.current[PROFILE_IDX] = el)}
        tabIndex={activeIdx === PROFILE_IDX ? 0 : -1}
        onClick={() => setActiveIdx(PROFILE_IDX)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 20px",
          background: activeIdx === PROFILE_IDX ? "rgba(255,255,255,0.09)" : "transparent",
          border: "none", borderLeft: "3px solid transparent",
          textAlign: "left", outline: "none",
          transition: "background 0.12s",
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: "rgba(255,255,255,0.12)", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.6)",
          border: activeIdx === PROFILE_IDX ? "2px solid rgba(255,255,255,0.5)" : "2px solid transparent",
          transition: "border-color 0.12s",
        }}>
          {avatarUrl
            ? <img src={avatarUrl} alt={profile?.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (profile?.name?.[0] || "?").toUpperCase()
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: activeIdx === PROFILE_IDX ? "#fff" : "rgba(255,255,255,0.65)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {profile?.name || "Профіль"}
          </div>
        </div>
      </button>

      {/* ── Sub-items ─────────────────────────────────────────────────── */}
      <div style={{
        overflow: "hidden",
        maxHeight: profileExpanded ? 120 : 0,
        opacity: profileExpanded ? 1 : 0,
        transition: "max-height 0.22s ease, opacity 0.18s ease",
      }}>
        {SUB_ITEMS.map((sub, i) => {
          const idx = PROFILE_IDX + 1 + i;
          const Icon = sub.icon;
          return (
            <NavBtn
              key={sub.action}
              ref_={(el) => (itemRefs.current[idx] = el)}
              icon={<Icon size={17} strokeWidth={1.8} />}
              label={sub.label}
              isFocused={activeIdx === idx}
              isCurrent={false}
              danger={sub.danger}
              indent
              onClick={() => handleSelect(idx)}
            />
          );
        })}
      </div>

      <div style={{ height: 20 }} />
    </nav>
  );
}

function NavBtn({ ref_, icon, label, isFocused, isCurrent, danger, indent, onClick }) {
  return (
    <button
      ref={ref_}
      tabIndex={isFocused ? 0 : -1}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 13,
        width: "100%",
        padding: indent ? "12px 20px 12px 36px" : "13px 20px",
        background: isFocused ? "rgba(255,255,255,0.09)" : "transparent",
        border: "none",
        borderLeft: isCurrent ? "3px solid rgba(255,255,255,0.85)" : "3px solid transparent",
        color: danger
          ? (isFocused ? "#ff6b6b" : "rgba(255,100,100,0.65)")
          : isCurrent ? "#fff"
          : isFocused ? "rgba(255,255,255,0.9)"
          : "rgba(255,255,255,0.5)",
        fontSize: indent ? 13 : 14,
        fontWeight: isCurrent ? 700 : 400,
        textAlign: "left",
        transition: "background 0.12s, color 0.12s",
        outline: "none",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
