import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import logoUrl from "../assets/icons/logo.svg";
import {
  androidCreateQrLogin,
  androidLoginAccount,
  androidPollQrLogin,
  isAndroidBridge,
} from "../api/AndroidBridge";
import { loginAccount } from "../api/auth";
import {
  hasAccountSession,
  hasSelectedProfile,
  setAuthSession,
  setProfilesCache,
} from "../core/session";
import TvKeyboard from "../components/ui/TvKeyboard";
import "../styles/Auth.css";

const ENTER_CODES = new Set([13, 29443, 65385, 117]);
const UP_CODES    = new Set([38, 29460]);
const DOWN_CODES  = new Set([40, 29461]);

export default function AuthLoginPage() {
  const navigate = useNavigate();
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [error,       setError]       = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kbField,     setKbField]     = useState(null); // "email" | "password" | null
  const [qrState,     setQrState]     = useState(null);
  const showQrPanel = isAndroidBridge() && Boolean(qrState?.qrImage);

  const emailRef  = useRef(null);
  const passRef   = useRef(null);
  const submitRef = useRef(null);
  const qrRef     = useRef(null);
  const switchRef = useRef(null);

  // ordered list of focusable refs
  const fields = isAndroidBridge()
    ? [emailRef, passRef, submitRef, qrRef, switchRef]
    : [emailRef, passRef, submitRef, switchRef];

  if (hasAccountSession()) {
    return <Navigate to={hasSelectedProfile() ? "/" : "/profiles"} replace />;
  }

  // Auto-focus first field on mount
  useEffect(() => {
    setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 120);
  }, []);

  const openKeyboard = (field) => setKbField(field);

  const closeKeyboard = (val) => {
    const field = kbField;
    if (field === "email")    setEmail(val);
    if (field === "password") setPassword(val);
    setKbField(null);
    setTimeout(() => {
      if (field === "email")    emailRef.current?.focus({ preventScroll: true });
      if (field === "password") passRef.current?.focus({ preventScroll: true });
    }, 60);
  };

  const handleSubmit = async () => {
    if (!email || !password) { setError("Заповніть усі поля"); return; }
    setError("");
    setIsSubmitting(true);
    try {
      if (isAndroidBridge()) {
        const data = await androidLoginAccount(email, password);
        setAuthSession({ token: data.auth_token, account: data.account, profile: null });
        setProfilesCache(Array.isArray(data.profiles) ? data.profiles : []);
        window.location.replace("/profiles");
      } else {
        const data = await loginAccount({ email, password });
        setAuthSession({ token: data.access_token, account: data.account, profile: null });
        window.location.replace("/profiles");
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Не вдалося увійти");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQrStart = async () => {
    setError("");
    try {
      const data = await androidCreateQrLogin();
      setQrState({
        token: data.token,
        qrUrl: data.qr_url,
        qrImage: data.qr_image_data_url,
        expiresIn: data.expires_in,
        status: "waiting",
      });
    } catch (err) {
      setError(err.message || "Не вдалося створити QR");
    }
  };

  useEffect(() => {
    if (!isAndroidBridge() || !qrState?.token || qrState.status !== "waiting") {
      return;
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const poll = await androidPollQrLogin(qrState.token);
        if (cancelled) return;

        if (poll.confirmed && poll.auth_token) {
          setAuthSession({ token: poll.auth_token, account: poll.account, profile: null });
          setProfilesCache(Array.isArray(poll.profiles) ? poll.profiles : []);
          setQrState((prev) => prev ? { ...prev, status: "confirmed" } : prev);
          window.location.replace("/profiles");
          return;
        }

        if (poll.expired) {
          setQrState((prev) => prev ? { ...prev, status: "expired" } : prev);
        }
      } catch (err) {
        if (!cancelled) {
          setQrState((prev) => prev ? { ...prev, status: "error", error: err.message } : prev);
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [qrState?.token, qrState?.status]);

  // D-pad UP/DOWN between field buttons — capture phase beats spatial nav
  useEffect(() => {
    if (kbField) return;
    const onKey = (e) => {
      const code = e.keyCode || e.which;
      if (!UP_CODES.has(code) && !DOWN_CODES.has(code)) return;
      const idx = fields.findIndex((r) => r.current === document.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (DOWN_CODES.has(code)) {
        fields[Math.min(idx + 1, fields.length - 1)].current?.focus({ preventScroll: true });
      } else {
        fields[Math.max(idx - 1, 0)].current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [kbField]);

  return (
    <div className="auth-page">
      <img src={logoUrl} className="auth-logo" alt="Nestify" />

      <div className="auth-body">
        <h1 className="auth-title">{showQrPanel ? "Увійти через QR" : "Увійти"}</h1>

        {!showQrPanel && (
          <div className="auth-form">
          {/* Email */}
          <button
            ref={emailRef}
            className="auth-field-btn"
            onClick={() => openKeyboard("email")}
          >
            <span className="auth-field-btn__label">Email</span>
            <span className={`auth-field-btn__value${!email ? " auth-field-btn__value--empty" : ""}`}>
              {email || "name@example.com"}
            </span>
            <ChevronRight size={16} className="auth-field-btn__chevron" />
          </button>

          {/* Password */}
          <button
            ref={passRef}
            className="auth-field-btn"
            onClick={() => openKeyboard("password")}
          >
            <span className="auth-field-btn__label">Пароль</span>
            <span className={`auth-field-btn__value${!password ? " auth-field-btn__value--empty" : ""}`}>
              {password ? "●".repeat(Math.min(password.length, 16)) : "••••••••"}
            </span>
            <ChevronRight size={16} className="auth-field-btn__chevron" />
          </button>

          {error && <div className="auth-error">{error}</div>}

          <button
            ref={submitRef}
            className="auth-btn"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Входимо…" : "Увійти"}
          </button>

          {isAndroidBridge() && (
            <button
              ref={qrRef}
              className="auth-btn"
              type="button"
              onClick={handleQrStart}
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
            >
              Увійти через QR
            </button>
          )}
          </div>
        )}

        {showQrPanel && (
          <div className="auth-qr-panel">
            <img
              src={qrState.qrImage}
              alt="TV login QR"
              className="auth-qr-image"
            />
            <div className="auth-qr-copy">
              {qrState.status === "waiting" && "Скануй QR та підтвердь вхід на телефоні"}
              {qrState.status === "expired" && "QR застарів. Створи новий код."}
              {qrState.status === "error" && (qrState.error || "Помилка підтвердження QR")}
            </div>
            <button
              ref={qrRef}
              className="auth-btn"
              type="button"
              onClick={handleQrStart}
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", maxWidth: 360 }}
            >
              Оновити QR
            </button>
          </div>
        )}
      </div>

      <button
        ref={switchRef}
        className="auth-switch-btn"
        onClick={() => navigate("/auth/register")}
      >
        Ще немає акаунта? <strong>Зареєструватись</strong>
      </button>

      {kbField && (
        <TvKeyboard
          value={kbField === "email" ? email : password}
          onChange={kbField === "email" ? setEmail : setPassword}
          onClose={closeKeyboard}
          masked={kbField === "password"}
          layout="en"
        />
      )}
    </div>
  );
}
