import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";

import "../styles/ConnectPlayerPage.css";

const ConnectPlayerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [deviceCode, setDeviceCode] = useState("");
  const [savedDeviceCode, setSavedDeviceCode] = useState("");
  const [status, setStatus] = useState(null); // { type: "success" | "error", message: string }
  const [isSaving, setIsSaving] = useState(false);

  // дістаємо device з query (?device=XXXX)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("device");

    const fromStorage =
      window.localStorage.getItem("nestify_player_device_id") || "";

    if (fromUrl) {
      setDeviceCode(fromUrl);
      setStatus({
        type: "success",
        message: "Код плеєра автоматично підставлено з QR 🎯",
      });
    } else if (fromStorage) {
      setDeviceCode(fromStorage);
    }

    setSavedDeviceCode(fromStorage);
  }, [location.search]);

  const handleSave = () => {
    const trimmed = deviceCode.trim();
    if (!trimmed) {
      setStatus({ type: "error", message: "Введи код плеєра." });
      return;
    }

    setIsSaving(true);
    try {
      // 1) зберігаємо в localStorage
      window.localStorage.setItem("nestify_player_device_id", trimmed);

      // 2) оновлюємо current_user (щоб було видно в профілі, якщо захочеш)
      const rawUser = window.localStorage.getItem("current_user");
      if (rawUser) {
        try {
          const user = JSON.parse(rawUser);
          user.player_device_id = trimmed;
          window.localStorage.setItem("current_user", JSON.stringify(user));
        } catch (e) {
          console.warn("[ConnectPlayerPage] failed to update current_user:", e);
        }
      }

      // 3) якщо в nestifyPlayerClient є спец-метод — пінгаємо його
      if (typeof nestifyPlayerClient.setDeviceId === "function") {
        nestifyPlayerClient.setDeviceId(trimmed);
      }

      setSavedDeviceCode(trimmed);
      setStatus({
        type: "success",
        message: "Плеєр підключено. Можна запускати фільми на ТВ 🚀",
      });

      // опціонально: легкий редірект додому
      // setTimeout(() => navigate("/", { replace: true }), 600);
    } catch (e) {
      console.error("[ConnectPlayerPage] save error:", e);
      setStatus({
        type: "error",
        message: "Не вдалось зберегти код. Спробуй ще раз.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    window.localStorage.removeItem("nestify_player_device_id");
    setDeviceCode("");
    setSavedDeviceCode("");
    setStatus({
      type: "success",
      message: "Підключення до плеєра скинуто.",
    });
  };

  return (
    <div className="connect-page">
      <div className="connect-card">
        <h1 className="connect-title">Підключення Nestify Player</h1>

        <p className="connect-subtitle">
          1. Відкрий <b>Nestify Player</b> на TV. <br />
          2. Відскануй QR з телефона або перепиши код плеєра. <br />
          3. Введи код нижче і збережи.
        </p>

        <label className="connect-label">Код плеєра</label>
        <input
          className="connect-input"
          type="text"
          placeholder="Напр. A1B2-C3D4"
          value={deviceCode}
          onChange={(e) => setDeviceCode(e.target.value)}
        />

        {savedDeviceCode && (
          <p className="connect-current">
            Зараз підключено: <code>{savedDeviceCode}</code>
          </p>
        )}

        {status && (
          <div
            className={
              "connect-status " +
              (status.type === "error"
                ? "connect-status--error"
                : "connect-status--success")
            }
          >
            {status.message}
          </div>
        )}

        <div className="connect-actions">
          <button
            className="connect-btn connect-btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Зберігаю..." : "Зберегти"}
          </button>

          {savedDeviceCode && (
            <button
              className="connect-btn connect-btn-secondary"
              onClick={handleClear}
            >
              Відʼєднати
            </button>
          )}
        </div>

        <button
          className="connect-link-back"
          type="button"
          onClick={() => navigate(-1)}
        >
          ← Назад
        </button>
      </div>
    </div>
  );
};

export default ConnectPlayerPage;
