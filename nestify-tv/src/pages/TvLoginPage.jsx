// src/pages/TvLoginPage.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tv2, Check, Loader2, AlertCircle } from "lucide-react";
import { getAuthToken, getCurrentProfile, hasAccountSession } from "../core/session";
import config from "../core/config";

export default function TvLoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [deviceName, setDeviceName] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ready | confirming | done | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Відсутній токен");
      return;
    }

    if (!hasAccountSession()) {
      navigate(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${config.backend_url}/api/v3/tv/qr/info/${token}`);
        if (res.status === 410) { setStatus("error"); setErrorMsg("QR-код застарів"); return; }
        if (res.status === 409) { setStatus("error"); setErrorMsg("Цей QR вже підтверджений"); return; }
        if (!res.ok) { setStatus("error"); setErrorMsg("Токен не знайдено"); return; }
        const data = await res.json();
        setDeviceName(data.device_name || "Телевізор");
        setStatus("ready");
      } catch {
        setStatus("error");
        setErrorMsg("Помилка з'єднання");
      }
    })();
  }, [token, navigate]);

  const handleConfirm = async () => {
    const profile = getCurrentProfile();
    if (!profile?.id) {
      setStatus("error");
      setErrorMsg("Не вибрано профіль. Поверніться та виберіть профіль.");
      return;
    }

    setStatus("confirming");
    try {
      const res = await fetch(`${config.backend_url}/api/v3/tv/qr/confirm/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ profile_id: profile.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(err.detail || "Помилка підтвердження");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMsg("Помилка з'єднання");
    }
  };

  const profile = getCurrentProfile();

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>
          <Tv2 size={36} />
        </div>

        {status === "loading" && (
          <>
            <Loader2 size={22} style={{ animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
            <p style={styles.sub}>Завантаження…</p>
          </>
        )}

        {status === "ready" && (
          <>
            <h1 style={styles.title}>Вхід на телевізор</h1>
            <p style={styles.sub}>
              Підтвердити вхід на пристрій <strong style={{ color: "#fff" }}>{deviceName}</strong>?
            </p>

            {profile && (
              <div style={styles.profileRow}>
                {profile.avatar_url && (
                  <img
                    src={`${config.backend_url}${profile.avatar_url}`}
                    alt={profile.name}
                    style={styles.avatar}
                  />
                )}
                <span style={{ color: "#fff", fontSize: 14 }}>{profile.name}</span>
              </div>
            )}

            <button style={styles.confirmBtn} onClick={handleConfirm}>
              <Check size={16} />
              Підтвердити
            </button>
          </>
        )}

        {status === "confirming" && (
          <>
            <Loader2 size={22} style={{ animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
            <p style={styles.sub}>Підтверджуємо…</p>
          </>
        )}

        {status === "done" && (
          <>
            <div style={styles.successIcon}>
              <Check size={28} />
            </div>
            <h2 style={styles.title}>Готово!</h2>
            <p style={styles.sub}>Телевізор авторизований. Можна закрити цю сторінку.</p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle size={28} color="#ff6b6b" style={{ marginBottom: 12 }} />
            <p style={{ ...styles.sub, color: "#ff6b6b" }}>{errorMsg}</p>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d0d0d",
    padding: 24,
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "40px 36px",
    maxWidth: 400,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 12,
    color: "#fff",
  },
  icon: {
    width: 64, height: 64, borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { fontSize: 15, color: "rgba(255,255,255,0.6)", margin: 0 },
  profileRow: {
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "10px 16px",
  },
  avatar: { width: 36, height: 36, borderRadius: "50%", objectFit: "cover" },
  confirmBtn: {
    display: "inline-flex", alignItems: "center", gap: 8,
    marginTop: 4, padding: "12px 32px",
    borderRadius: 999, background: "#fff", color: "#0d0d0d",
    fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
  },
  successIcon: {
    width: 56, height: 56, borderRadius: "50%",
    background: "rgba(20,255,114,0.15)",
    border: "1px solid rgba(20,255,114,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#14ff72", marginBottom: 4,
  },
};
