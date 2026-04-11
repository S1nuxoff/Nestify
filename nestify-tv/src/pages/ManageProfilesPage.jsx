import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Plus, Check } from "lucide-react";
import { androidActivateProfile, isAndroidBridge } from "../api/AndroidBridge";
import { getMe } from "../api/auth";
import { hasAccountSession, setCurrentProfile, getCurrentProfile } from "../core/session";
import config from "../core/config";
import "../styles/ManageProfilesPage.css";

export default function ManageProfilesPage() {
  const navigate    = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const current = getCurrentProfile();

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;

  useEffect(() => {
    getMe()
      .then((d) => setProfiles(Array.isArray(d?.profiles) ? d.profiles : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSwitch = (profile) => {
    if (profile.id === current?.id) return;
    Promise.resolve()
      .then(() => (isAndroidBridge() ? androidActivateProfile(profile) : null))
      .then(() => {
        setCurrentProfile(profile);
        window.location.href = "/";
      })
      .catch(() => {});
  };

  return (
    <div className="mp-root">
      <h1 className="mp-title">Хто дивиться?</h1>

      {loading ? (
        <div className="mp-loading"><div className="spinner" /></div>
      ) : (
        <div className="mp-grid">
          {profiles.map((p) => {
            const isActive = p.id === current?.id;
            return (
              <button
                key={p.id}
                className={`mp-card${isActive ? " mp-card--active" : ""}`}
                onClick={() => handleSwitch(p)}
              >
                <div className="mp-card__avatar">
                  {p.avatar_url
                    ? <img src={`${config.backend_url}${p.avatar_url}`} alt={p.name} />
                    : <span>{(p.name?.[0] || "P").toUpperCase()}</span>
                  }
                  {isActive && (
                    <div className="mp-card__check">
                      <Check size={16} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className="mp-card__name">{p.name}</span>
                {isActive && <span className="mp-card__badge">Активний</span>}
              </button>
            );
          })}

          <button
            className="mp-card mp-card--add"
            onClick={() => navigate("/profiles/new")}
          >
            <div className="mp-card__avatar mp-card__avatar--add">
              <Plus size={28} />
            </div>
            <span className="mp-card__name">Додати</span>
          </button>
        </div>
      )}
    </div>
  );
}
