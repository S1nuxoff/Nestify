import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings, Tv, Camera, Headphones, Info, MonitorSmartphone,
  LogOut, Plus, Pencil, Link,
} from "lucide-react";
import { getMe } from "../api/auth";
import { clearAuthSession, getCurrentProfile, setCurrentProfile } from "../core/session";
import Header from "../components/layout/Header";
import config from "../core/config";
import "../styles/AccountSettingsPage.css";

const MENU_ITEMS = [
  { icon: Settings,         label: "Акаунт",       path: "/account/account" },
  { icon: Tv,               label: "Підключити ТВ", path: "/connect" },
  { icon: Camera,           label: "Налаштування", path: "/account/prefs"   },
  { icon: Headphones,       label: "Пристрої",     path: "/account/devices" },
  { icon: Info,             label: "Підписки",     path: "/account/subs"    },
  { icon: MonitorSmartphone,label: "Про сервіс",   path: "/account/about"   },
];

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const currentProfile = getCurrentProfile();

  useEffect(() => {
    getMe()
      .then((data) => setProfiles(Array.isArray(data?.profiles) ? data.profiles : []))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/auth/login");
    window.location.reload();
  };

  return (
    <div className="acc-root">
      <Header currentUser={currentProfile || {}} />
      <h1 className="acc-title">Акаунт</h1>

      {/* Profiles row */}
      <div className="acc-profiles">
        {[...profiles].sort((a, b) => (b.id === currentProfile?.id ? 1 : 0) - (a.id === currentProfile?.id ? 1 : 0)).map((p) => {
          const isCurrent = p.id === currentProfile?.id;
          return (
          <div key={p.id} className={`acc-profile${isCurrent ? " acc-profile--current" : ""}`}>
            <button
              className={`acc-profile__avatar${isCurrent ? " acc-profile__avatar--active" : ""}`}
              onClick={() => {
                if (editMode) navigate(`/profiles/${p.id}/edit`);
                else if (!isCurrent) { setCurrentProfile(p); window.location.reload(); }
              }}
            >
              {p.avatar_url ? (
                <img src={`${config.backend_url}${p.avatar_url}`} alt={p.name} />
              ) : (
                <span>{p.name?.[0]?.toUpperCase() || "P"}</span>
              )}
              {editMode && (
                <div className="acc-profile__edit">
                  <Pencil size={isCurrent ? 16 : 13} />
                </div>
              )}
            </button>
            <span className="acc-profile__name">{p.name}</span>
          </div>
          );
        })}
        <div className="acc-profile">
          <button className="acc-profile__add" onClick={() => navigate("/profiles/new")}>
            <Plus size={22} />
          </button>
          <span className="acc-profile__name">Додати</span>
        </div>
      </div>

      {/* Manage profiles */}
      <button className="acc-manage" onClick={() => setEditMode((v) => !v)}>
        <Link size={15} />
        {editMode ? "Готово" : "Керувати профілями"}
      </button>

      {/* Menu grid */}
      <div className="acc-grid">
        {MENU_ITEMS.map(({ icon: Icon, label, path }) => (
          <button key={label} className="acc-tile" onClick={() => navigate(path)}>
            <div className="acc-tile__icon">
              <Icon size={22} />
            </div>
            <span className="acc-tile__label">{label}</span>
          </button>
        ))}
      </div>

      {/* Sign out */}
      <button className="acc-signout" onClick={handleLogout}>
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  );
}
