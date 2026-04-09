import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import logoUrl from "../assets/icons/logo.svg";
import { registerAccount } from "../api/auth";
import { hasAccountSession, hasSelectedProfile, setAuthSession } from "../core/session";
import "../styles/Auth.css";

export default function AuthRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", profile_name: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (hasAccountSession()) {
    return <Navigate to={hasSelectedProfile() ? "/" : "/profiles"} replace />;
  }

  const handleChange = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const data = await registerAccount(form);
      setAuthSession({ token: data.access_token, account: data.account, profile: data.selected_profile || null });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Не вдалося створити акаунт");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <img src={logoUrl} className="auth-logo" alt="Nestify" />

      <div className="auth-body">
      <h1 className="auth-title">Створити акаунт</h1>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <span className="auth-field__label">Ім'я профілю</span>
          <input
            className="auth-field__input"
            type="text"
            value={form.profile_name}
            onChange={handleChange("profile_name")}
            placeholder="Наприклад, Vadym"
            maxLength={20}
            required
            autoComplete="nickname"
          />
        </div>

        <div className="auth-field">
          <span className="auth-field__label">Email</span>
          <input
            className="auth-field__input"
            type="email"
            value={form.email}
            onChange={handleChange("email")}
            placeholder="name@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <span className="auth-field__label">Пароль</span>
          <input
            className="auth-field__input"
            type={showPwd ? "text" : "password"}
            value={form.password}
            onChange={handleChange("password")}
            placeholder="Мінімум 8 символів"
            minLength={8}
            required
            autoComplete="new-password"
          />
          <button type="button" className="auth-field__eye" onClick={() => setShowPwd(v => !v)} tabIndex={-1}>
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-btn" disabled={isSubmitting}>
          {isSubmitting ? "Створюємо..." : "Зареєструватись"}
        </button>

        <p className="auth-hint">Продовжуючи, ти приймаєш нашу <strong>Політику конфіденційності</strong></p>
      </form>

      </div>

      <p className="auth-switch">
        Вже є акаунт? <Link to="/auth/login">Увійти</Link>
      </p>
    </div>
  );
}
