import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";

import "../styles/ConnectPlayerPage.css";

const CODE_LENGTH = 8;

const ConnectPlayerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [codeDigits, setCodeDigits] = useState(Array(CODE_LENGTH).fill("")); // ["", "", ...]
  const [savedDeviceCode, setSavedDeviceCode] = useState("");
  const [status, setStatus] = useState(null); // { type: "success" | "error", message: string }
  const [isSaving, setIsSaving] = useState(false);

  const inputsRef = useRef([]);

  // допоміжна: заповнити бокси з довільного рядка
  const fillFromString = (value) => {
    const clean = (value || "").replace(/[^0-9a-zA-Z]/g, "").toUpperCase();

    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < CODE_LENGTH && i < clean.length; i++) {
      next[i] = clean[i];
    }
    setCodeDigits(next);
  };

  // дістаємо device з query (?device=XXXX) / localStorage
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("device");

    const fromStorage =
      window.localStorage.getItem("nestify_player_device_id") || "";

    if (fromUrl) {
      fillFromString(fromUrl);
      setStatus({
        type: "success",
        message: "Код плеєра автоматично підставлено з QR 🎯",
      });
      setSavedDeviceCode(fromStorage || fromUrl);
    } else if (fromStorage) {
      fillFromString(fromStorage);
      setSavedDeviceCode(fromStorage);
    }
  }, [location.search]);

  const handleDigitChange = (index, raw) => {
    let value = raw;

    // беремо останній введений символ
    if (value.length > 1) {
      value = value.slice(-1);
    }

    // тільки цифри/букви
    if (value && !/[0-9a-zA-Z]/.test(value)) {
      return;
    }

    const upper = value.toUpperCase();

    setCodeDigits((prev) => {
      const next = [...prev];
      next[index] = upper;
      return next;
    });

    // якщо ввели символ — переходимо на наступне поле
    if (upper && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (codeDigits[index]) {
        // просто очищаємо поточне
        setCodeDigits((prev) => {
          const next = [...prev];
          next[index] = "";
          return next;
        });
      } else if (index > 0) {
        // якщо вже пусто — перескакуємо назад
        inputsRef.current[index - 1]?.focus();
      }
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text") || "";
    const clean = pasted.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();

    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < CODE_LENGTH && i < clean.length; i++) {
      next[i] = clean[i];
    }
    setCodeDigits(next);

    const lastFilledIndex = Math.min(clean.length, CODE_LENGTH) - 1;
    if (lastFilledIndex >= 0) {
      inputsRef.current[lastFilledIndex]?.focus();
    }
  };

  const handleSave = () => {
    const trimmed = codeDigits.join("").trim();

    if (!trimmed) {
      setStatus({ type: "error", message: "Введи код плеєра." });
      return;
    }

    setIsSaving(true);
    try {
      // 1) зберігаємо в localStorage
      window.localStorage.setItem("nestify_player_device_id", trimmed);

      // 2) оновлюємо current_user
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

      // 3) оновлюємо клієнт, якщо є метод
      if (typeof nestifyPlayerClient.setDeviceId === "function") {
        nestifyPlayerClient.setDeviceId(trimmed);
      }

      setSavedDeviceCode(trimmed);
      setStatus({
        type: "success",
        message: "Плеєр підключено. Можна запускати фільми на ТВ 🚀",
      });

      // невелика пауза і редірект на головну
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 700);
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
    setCodeDigits(Array(CODE_LENGTH).fill(""));
    setSavedDeviceCode("");
    setStatus({
      type: "success",
      message: "Підключення до плеєра скинуто.",
    });
  };

  return (
    <div className="connect-page">
      <div className="connect-card">
        <div className="connect-chip">TV · Nestify Player</div>

        <h1 className="connect-title">Підключення Nestify Player</h1>

        <p className="connect-subtitle">
          Введи код з екрана TV, щоб лінканути браузер з Nestify Player. Потім
          просто тисни <b>“Play на TV”</b> у фільмах.
        </p>

        <ol className="connect-steps">
          <li>
            Відкрий <b>Nestify Player</b> на TV.
          </li>
          <li>Знайди код (або відскануй QR з цього сайту).</li>
          <li>
            Введи код нижче й натисни <b>“Зберегти”</b>.
          </li>
        </ol>

        {/* OTP-бокси */}
        <div className="connect-otp-wrapper" onPaste={handlePaste}>
          {codeDigits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (inputsRef.current[idx] = el)}
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              maxLength={1}
              className="connect-otp-input"
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
            />
          ))}
        </div>

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
      </div>
    </div>
  );
};

export default ConnectPlayerPage;
