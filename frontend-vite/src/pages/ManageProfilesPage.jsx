import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus } from "lucide-react";
import { getMe } from "../api/auth";
import { hasAccountSession } from "../core/session";
import config from "../core/config";
import "../styles/ManageProfilesPage.css";

export default function ManageProfilesPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;

  useEffect(() => {
    getMe()
      .then((data) => setProfiles(Array.isArray(data?.profiles) ? data.profiles : []))
      .catch(() => {});
  }, []);

  return (
    <div className="mp-root">
      <div className="mp-header">
        <button className="mp-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="mp-title">Профілі</h1>
        <div style={{ width: 40 }} />
      </div>

      <div className="mp-list">
        {profiles.map((p) => (
          <button
            key={p.id}
            className="mp-row"
            onClick={() => navigate(`/profiles/${p.id}/edit`)}
          >
            <div className="mp-row__avatar">
              {p.avatar_url ? (
                <img src={`${config.backend_url}${p.avatar_url}`} alt={p.name} />
              ) : (
                <span>{p.name?.[0]?.toUpperCase() || "P"}</span>
              )}
            </div>
            <span className="mp-row__name">{p.name}</span>
            <ChevronLeft size={18} className="mp-row__chevron" />
          </button>
        ))}

        <button className="mp-row mp-row--add" onClick={() => navigate("/profiles/new")}>
          <div className="mp-row__avatar mp-row__avatar--add">
            <Plus size={22} />
          </div>
          <span className="mp-row__name">Додати профіль</span>
        </button>
      </div>
    </div>
  );
}
