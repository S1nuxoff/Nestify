import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { androidActivateProfile, isAndroidBridge } from "../api/AndroidBridge";
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

const ENTER_CODES = new Set([13, 29443, 65385, 117]);
const UP_CODES    = new Set([38, 29460]);
const DOWN_CODES  = new Set([40, 29461]);
const LEFT_CODES  = new Set([37, 4]);
const RIGHT_CODES = new Set([39, 5]);

function LoginPage() {
  const navigate = useNavigate();
  const [users,   setUsers]   = useState(() => getProfilesCache());
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [focused, setFocused] = useState(0);
  const btnRefs = useRef([]);

  useEffect(() => {
    if (!hasAccountSession()) return;
    setLoading(true);
    getMe()
      .then((data) => {
        const list = Array.isArray(data?.profiles) ? data.profiles : [];
        setUsers(list);
        setProfilesCache(list);
      })
      .catch(() => {
        clearAuthSession();
        setError("Сесія завершилась. Увійди ще раз.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-focus first profile after load
  useEffect(() => {
    if (!loading && btnRefs.current[0]) {
      setTimeout(() => btnRefs.current[0]?.focus({ preventScroll: true }), 120);
    }
  }, [loading]);

  // D-pad navigation — grid layout (wrap columns)
  useEffect(() => {
    const COLS = 4;
    const total = users.length;

    const onKey = (e) => {
      const code = e.keyCode || e.which;
      if (!UP_CODES.has(code) && !DOWN_CODES.has(code) &&
          !LEFT_CODES.has(code) && !RIGHT_CODES.has(code) &&
          !ENTER_CODES.has(code)) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      if (ENTER_CODES.has(code)) {
        btnRefs.current[focused]?.click();
        return;
      }

      let next = focused;
      if (RIGHT_CODES.has(code)) next = Math.min(focused + 1, total - 1);
      if (LEFT_CODES.has(code))  next = Math.max(focused - 1, 0);
      if (DOWN_CODES.has(code))  next = Math.min(focused + COLS, total - 1);
      if (UP_CODES.has(code))    next = Math.max(focused - COLS, 0);

      setFocused(next);
      btnRefs.current[next]?.focus({ preventScroll: true });
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focused, users.length]);

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;
  if (hasSelectedProfile()) return <Navigate to="/" replace />;

  const handleSelect = async (user) => {
    try {
      if (isAndroidBridge()) {
        await androidActivateProfile(user);
      }
      setCurrentProfile(user);
      navigate("/");
    } catch (e) {
      setError(e.message || "Не вдалося активувати профіль");
    }
  };

  return (
    <div className="ww-page">
      <h1 className="ww-title">Хто дивиться?</h1>

      {error && <p className="ww-error">{error}</p>}

      {loading ? (
        <div className="ww-loading">
          <span className="ww-spinner" />
        </div>
      ) : (
        <div className="ww-grid">
          {users.map((user, i) => (
            <button
              key={user.id}
              ref={(el) => (btnRefs.current[i] = el)}
              className={`ww-profile${focused === i ? " ww-profile--focused" : ""}`}
              onClick={() => handleSelect(user)}
              tabIndex={focused === i ? 0 : -1}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="ww-avatar">
                <img src={`${config.backend_url}${user.avatar_url}`} alt={user.name} />
              </div>
              <span className="ww-name">{user.name}</span>
            </button>
          ))}

        </div>
      )}
    </div>
  );
}

export default LoginPage;
