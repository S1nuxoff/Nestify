import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";

import "../styles/ConnectPlayerPage.css";

const CODE_LENGTH = 8;

const ConnectPlayerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [codeDigits, setCodeDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [savedDeviceCode, setSavedDeviceCode] = useState("");
  const [status, setStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const inputsRef = useRef([]);

  const fillFromString = (value) => {
    const clean = (value || "").replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < CODE_LENGTH && i < clean.length; i++) {
      next[i] = clean[i];
    }
    setCodeDigits(next);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("device");
    const fromStorage =
      window.localStorage.getItem("nestify_player_device_id") || "";

    if (fromUrl) {
      fillFromString(fromUrl);
      setStatus({ type: "success", message: "Код розпізнано автоматично ✨" });
    } else if (fromStorage) {
      fillFromString(fromStorage);
    }
    setSavedDeviceCode(fromStorage);

    if (!fromUrl && !fromStorage) {
      inputsRef.current[0]?.focus();
    }
  }, [location.search]);

  const handleDigitChange = (index, raw) => {
    let value = raw.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
    if (value.length > 1) value = value.slice(-1);

    const next = [...codeDigits];
    next[index] = value;
    setCodeDigits(next);

    if (value && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text") || "";
    fillFromString(pasted);
  };

  const handleSave = async () => {
    const trimmed = codeDigits.join("").trim();
    if (trimmed.length < CODE_LENGTH) {
      setStatus({ type: "error", message: "Будь ласка, введіть повний код" });
      return;
    }

    setIsSaving(true);
    try {
      window.localStorage.setItem("nestify_player_device_id", trimmed);
      const rawUser = window.localStorage.getItem("current_user");
      if (rawUser) {
        const user = JSON.parse(rawUser);
        user.player_device_id = trimmed;
        window.localStorage.setItem("current_user", JSON.stringify(user));
      }
      if (typeof nestifyPlayerClient.setDeviceId === "function") {
        nestifyPlayerClient.setDeviceId(trimmed);
      }

      setStatus({
        type: "success",
        message: "Пристрій підключено. Приємного перегляду!",
      });
      setTimeout(() => navigate("/"), 1000);
    } catch (e) {
      setStatus({ type: "error", message: "Помилка збереження." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="hbo-container">
      {/* Світіння на фоні в стилі Max */}
      <div className="hbo-aura-1"></div>
      <div className="hbo-aura-2"></div>

      <div className="hbo-content">
        <div className="hbo-header">
          <h1 className="hbo-title">Підключення телевізора</h1>
          <p className="hbo-description">
            Введіть код, який ви бачите на екрані вашого пристрою, щоб почати
            трансляцію.
          </p>
        </div>

        <div className="hbo-otp-group" onPaste={handlePaste}>
          {codeDigits.map((digit, idx) => (
            <div key={idx} className="hbo-otp-box">
              <input
                ref={(el) => (inputsRef.current[idx] = el)}
                type="text"
                className={`hbo-otp-input ${digit ? "has-value" : ""}`}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                maxLength={1}
                spellCheck="false"
                autoComplete="off"
              />
              <div className="hbo-otp-underline"></div>
            </div>
          ))}
        </div>

        {status && (
          <div className={`hbo-status hbo-status--${status.type}`}>
            {status.message}
          </div>
        )}

        <div className="hbo-actions">
          <button
            className="hbo-btn hbo-btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "З'ЄДНАННЯ..." : "ПІДТВЕРДИТИ"}
          </button>

          <button className="hbo-btn hbo-btn-link" onClick={() => navigate(-1)}>
            СКАСУВАТИ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectPlayerPage;
