import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus } from "lucide-react";
import { getMe } from "../api/auth";
import { clearAuthSession, getCurrentProfile, setCurrentProfile, getProfilesCache, setProfilesCache } from "../core/session";
import Header from "../components/layout/Header";
import config from "../core/config";
import "../styles/AccountSettingsPage.css";

const MENU_ITEMS = [
  { label: "Розширення", path: "/account/extensions" },
  { label: "Підключити ТВ", path: "/connect" },
  { label: "Пристрої", path: "/account/devices" },
  { label: "Налаштування", path: "/account/prefs" },
  { label: "Акаунт", path: "/account/account" },
  { label: "Про сервіс", path: "/account/about" },
];

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState(() => getProfilesCache());
  const [editMode, setEditMode] = useState(false);
  const currentProfile = getCurrentProfile();

  useEffect(() => {
    getMe()
      .then((data) => {
        const list = Array.isArray(data?.profiles) ? data.profiles : [];
        setProfiles(list);
        setProfilesCache(list);
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    navigate("/auth/login");
    window.location.reload();
  };

  return (
    <div className="acc-root acc-root--full">
      <Header currentUser={currentProfile || {}} />
      <div className="acc-page acc-page--profile">
        <div className="acc-page__who">
        <h1 className="acc-headline">Хто дивиться</h1>

        <div className="acc-who">
          {[...profiles].sort((a, b) => (b.id === currentProfile?.id ? 1 : 0) - (a.id === currentProfile?.id ? 1 : 0)).map((p) => {
            const isCurrent = p.id === currentProfile?.id;
            return (
              <div key={p.id} className={`acc-who__profile${isCurrent ? " acc-who__profile--current" : ""}`}>
                <button
                  className="acc-who__avatar"
                  aria-label={editMode ? `Редагувати профіль ${p.name}` : `Обрати профіль ${p.name}`}
                  onClick={() => {
                    if (editMode) { navigate(`/profiles/${p.id}/edit`); return; }
                    if (!isCurrent) { setCurrentProfile(p); window.location.reload(); }
                  }}
                >
                  {p.avatar_url ? (
                    <img src={`${config.backend_url}${p.avatar_url}`} alt="" />
                  ) : (
                    <span>{p.name?.[0]?.toUpperCase() || "P"}</span>
                  )}
                  {editMode && <span className="acc-who__edit"><Pencil size={20} /></span>}
                </button>
                <span className="acc-who__name">{p.name}</span>
              </div>
            );
          })}
          <div className="acc-who__profile">
            <button className="acc-who__avatar acc-who__avatar--add" onClick={() => navigate("/profiles/new")} aria-label="Додати профіль">
              <Plus size={30} strokeWidth={1.5} />
            </button>
            <span className="acc-who__name">Додати</span>
          </div>
        </div>
        <button className="acc-quiet" onClick={() => setEditMode((v) => !v)}>
          {editMode ? "Готово" : "Змінити профілі"}
        </button>
        </div>

        <div className="acc-page__links">
        <nav className="acc-menu" aria-label="Налаштування">
          {MENU_ITEMS.map(({ label, path }) => (
            <button key={label} onClick={() => navigate(path)}>{label}</button>
          ))}
        </nav>

        <button className="acc-quiet" onClick={handleLogout}>Вийти з акаунту</button>
        </div>
      </div>
    </div>
  );
}
