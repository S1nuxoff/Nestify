// src/pages/UserSettingsPage.jsx
import React, { useEffect, useState } from "react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import "../styles/UserSettingsPage.css";
import config from "../core/config";

const API_BASE = config.backend_url;

function safeGetInitialUser() {
  try {
    const raw = localStorage.getItem("current_user");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Bad current_user in localStorage", e);
    return null;
  }
}

function UserSettingsPage() {
  const initialUser = safeGetInitialUser();

  const [currentUser, setCurrentUser] = useState(initialUser);
  const [kodiAddress, setKodiAddress] = useState(
    initialUser?.kodi_address || ""
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // "ok" | "error" | null

  useEffect(() => {
    if (currentUser?.kodi_address) {
      setKodiAddress(currentUser.kodi_address);
    }
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;

    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/user/${currentUser.id}/kodi_address`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kodi_address: kodiAddress || null,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to save kodi_address");
      }

      const data = await res.json();

      const updatedUser = {
        ...currentUser,
        kodi_address: data.kodi_address,
      };
      localStorage.setItem("current_user", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);

      setStatus("ok");
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container">
      <Header
        categories={[]}
        currentUser={currentUser || {}}
        onSearch={() => {}}
        onMovieSelect={() => {}}
      />

      <div className="user-settings-page">
        {/* Легка «димка» як у модалки */}
        <div className="user-settings-backdrop" />

        <div className="user-settings-card">
          <div className="user-settings-card__header">
            <div className="user-settings-card__title-block">
              <h1 className="user-settings-title">Налаштування користувача</h1>
              <p className="user-settings-subtitle">
                Задай адресу Kodi, щоб керування працювало без магії й костилів.
              </p>
            </div>

            {currentUser && (
              <div className="user-settings-user-pill">
                <div className="user-settings-user-avatar">
                  {currentUser.avatar_url ? (
                    <img src={currentUser.avatar_url} alt={currentUser.name} />
                  ) : (
                    <span>{currentUser.name?.[0]?.toUpperCase() || "U"}</span>
                  )}
                </div>
                <div className="user-settings-user-meta">
                  <span className="user-settings-user-name">
                    {currentUser.name}
                  </span>
                  <span className="user-settings-user-role">
                    Активний профіль
                  </span>
                </div>
              </div>
            )}
          </div>

          {!currentUser && (
            <div className="user-settings-empty">
              <p className="user-settings-hint">
                Користувач не вибраний. Спочатку обери профіль на головній.
              </p>
            </div>
          )}

          {currentUser && (
            <form className="user-settings-form" onSubmit={handleSubmit}>
              <div className="user-settings-field-group">
                <div className="user-settings-field">
                  <label className="user-settings-label">Імʼя</label>
                  <div className="user-settings-value">{currentUser.name}</div>
                </div>

                <div className="user-settings-field">
                  <label htmlFor="kodi_address" className="user-settings-label">
                    Адреса Kodi (WebSocket)
                  </label>
                  <input
                    id="kodi_address"
                    type="text"
                    className="user-settings-input"
                    placeholder="ws://192.168.0.100:9090"
                    value={kodiAddress}
                    onChange={(e) => setKodiAddress(e.target.value)}
                  />
                  <p className="user-settings-help">
                    Приклад: <code>ws://192.168.0.44:9090</code> або{" "}
                    <code>ws://kodi.local:9090</code>
                  </p>
                </div>
              </div>

              <div className="user-settings-footer-row">
                <button
                  type="submit"
                  className="user-settings-save-btn"
                  disabled={saving}
                >
                  {saving ? "Збереження..." : "Зберегти"}
                </button>

                {status === "ok" && (
                  <div className="user-settings-status ok">
                    Збережено успішно ✅
                  </div>
                )}
                {status === "error" && (
                  <div className="user-settings-status error">
                    Помилка при збереженні. Спробуй ще раз.
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default UserSettingsPage;
