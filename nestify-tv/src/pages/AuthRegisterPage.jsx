import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import logoUrl from "../assets/icons/logo.svg";
import { registerAccount } from "../api/auth";
import { hasAccountSession, hasSelectedProfile, setAuthSession } from "../core/session";
import TvKeyboard from "../components/ui/TvKeyboard";
import "../styles/Auth.css";

const UP_CODES   = new Set([38, 29460]);
const DOWN_CODES = new Set([40, 29461]);

export default function AuthRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", profile_name: "" });
  const [error,        setError]        = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kbField,      setKbField]      = useState(null); // "profile_name" | "email" | "password"

  const nameRef   = useRef(null);
  const emailRef  = useRef(null);
  const passRef   = useRef(null);
  const submitRef = useRef(null);
  const switchRef = useRef(null);

  const fields = [nameRef, emailRef, passRef, submitRef, switchRef];

  if (hasAccountSession()) {
    return <Navigate to={hasSelectedProfile() ? "/" : "/profiles"} replace />;
  }

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 120);
  }, []);

  const openKeyboard  = (field) => setKbField(field);

  const closeKeyboard = (val) => {
    const field = kbField;
    setForm((prev) => ({ ...prev, [field]: val }));
    setKbField(null);
    setTimeout(() => {
      if (field === "profile_name") nameRef.current?.focus({ preventScroll: true });
      if (field === "email")        emailRef.current?.focus({ preventScroll: true });
      if (field === "password")     passRef.current?.focus({ preventScroll: true });
    }, 60);
  };

  const handleSubmit = async () => {
    if (!form.profile_name || !form.email || !form.password) {
      setError("Заповніть усі поля"); return;
    }
    if (form.password.length < 8) {
      setError("Пароль повинен бути мінімум 8 символів"); return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const data = await registerAccount(form);
      setAuthSession({ token: data.access_token, account: data.account, profile: data.selected_profile || null });
      window.location.replace("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Не вдалося створити акаунт");
    } finally {
      setIsSubmitting(false);
    }
  };

  // D-pad UP/DOWN — capture phase beats spatial nav
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

  const kbLayout  = kbField === "profile_name" ? "uk" : "en";
  const kbMasked  = kbField === "password";
  const kbValue   = kbField ? form[kbField] : "";

  return (
    <div className="auth-page">
      <img src={logoUrl} className="auth-logo" alt="Nestify" />

      <div className="auth-body">
        <h1 className="auth-title">Створити акаунт</h1>

        <div className="auth-form">
          {/* Profile name */}
          <button
            ref={nameRef}
            className="auth-field-btn"
            onClick={() => openKeyboard("profile_name")}
          >
            <span className="auth-field-btn__label">Ім'я профілю</span>
            <span className={`auth-field-btn__value${!form.profile_name ? " auth-field-btn__value--empty" : ""}`}>
              {form.profile_name || "Наприклад, Vadym"}
            </span>
            <ChevronRight size={16} className="auth-field-btn__chevron" />
          </button>

          {/* Email */}
          <button
            ref={emailRef}
            className="auth-field-btn"
            onClick={() => openKeyboard("email")}
          >
            <span className="auth-field-btn__label">Email</span>
            <span className={`auth-field-btn__value${!form.email ? " auth-field-btn__value--empty" : ""}`}>
              {form.email || "name@example.com"}
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
            <span className={`auth-field-btn__value${!form.password ? " auth-field-btn__value--empty" : ""}`}>
              {form.password ? "●".repeat(Math.min(form.password.length, 16)) : "Мінімум 8 символів"}
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
            {isSubmitting ? "Створюємо…" : "Зареєструватись"}
          </button>
        </div>
      </div>

      <button
        ref={switchRef}
        className="auth-switch-btn"
        onClick={() => navigate("/auth/login")}
      >
        Вже є акаунт? <strong>Увійти</strong>
      </button>

      {kbField && (
        <TvKeyboard
          value={kbValue}
          onChange={(val) => setForm((prev) => ({ ...prev, [kbField]: val }))}
          onClose={closeKeyboard}
          masked={kbMasked}
          layout={kbLayout}
        />
      )}
    </div>
  );
}
