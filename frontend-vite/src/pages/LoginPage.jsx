import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { getMe } from "../api/auth";
import config from "../core/config";
import {
  clearAuthSession,
  hasAccountSession,
  hasSelectedProfile,
  setCurrentProfile,
  getProfilesCache,
  setProfilesCache,
} from "../core/session";
import "../styles/WhoWatching.css";

function LoginPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState(() => getProfilesCache());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasAccountSession()) return;
    getMe()
      .then((data) => {
        const list = Array.isArray(data?.profiles) ? data.profiles : [];
        setUsers(list);
        setProfilesCache(list);
      })
      .catch(() => {
        clearAuthSession();
        setError("Сесія завершилась. Увійди ще раз.");
      });
  }, []);

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;
  if (hasSelectedProfile()) return <Navigate to="/" replace />;

  return (
    <div className="ww-page">
      <h1 className="ww-title">Хто дивиться?</h1>

      {error && <p className="ww-error">{error}</p>}

      <div className="ww-grid">
        {users.map((user, i) => (
          <button
            key={user.id}
            className="ww-profile"
            onClick={() => { setCurrentProfile(user); navigate("/"); }}
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <div className="ww-avatar">
              <img src={`${config.backend_url}${user.avatar_url}`} alt={user.name} />
            </div>
            <span className="ww-name">{user.name}</span>
          </button>
        ))}

        <button
          className="ww-profile"
          onClick={() => navigate("/profiles/new")}
          style={{ animationDelay: `${users.length * 0.07}s` }}
        >
          <div className="ww-avatar ww-avatar--add">
            <Plus size={28} strokeWidth={1.5} />
          </div>
          <span className="ww-name ww-name--dim">Додати профіль</span>
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
