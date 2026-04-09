import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import logoUrl from "../assets/icons/logo.svg";
import { loginAccount } from "../api/auth";
import { hasAccountSession, hasSelectedProfile, setAuthSession } from "../core/session";
import "../styles/Auth.css";

export default function AuthLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (hasAccountSession()) {
    return <Navigate to={hasSelectedProfile() ? "/" : "/profiles"} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const data = await loginAccount({ email, password });
      setAuthSession({ token: data.access_token, account: data.account, profile: null });
      navigate("/profiles", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Не вдалося увійти");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <img src={logoUrl} className="auth-logo" alt="Nestify" />

      <div className="auth-body">
      <h1 className="auth-title">Увійти</h1>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <span className="auth-field__label">Email</span>
          <input
            className="auth-field__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
          <button type="button" className="auth-field__eye" onClick={() => setShowPwd(v => !v)} tabIndex={-1}>
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-btn" disabled={isSubmitting}>
          {isSubmitting ? "Входимо..." : "Увійти"}
        </button>

        <p className="auth-hint">Продовжуючи, ти приймаєш нашу <strong>Політику конфіденційності</strong></p>
      </form>

      </div>

      <p className="auth-switch">
        Ще немає акаунта? <Link to="/auth/register">Зареєструватись</Link>
      </p>
    </div>
  );
}
