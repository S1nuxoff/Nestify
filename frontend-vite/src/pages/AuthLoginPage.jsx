import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { loginAccount } from "../api/auth";
import { hasAccountSession, hasSelectedProfile, setAuthSession } from "../core/session";

export default function AuthLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setAuthSession({
        token: data.access_token,
        account: data.account,
        profile: null,
      });
      navigate("/profiles", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Не вдалося увійти");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full rounded-[32px] border border-white/10 bg-white/[0.03] p-7 backdrop-blur-sm sm:p-8">
          <div className="text-sm uppercase tracking-[0.22em] text-white/45">
            Nestify
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-white">Увійти</h1>
          <p className="mt-2 text-sm leading-6 text-white/62">
            Увійди по email, а профіль виберемо вже на наступному екрані.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/28 focus:border-white/20"
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/28 focus:border-white/20"
                placeholder="********"
                required
              />
            </label>

            {error ? <div className="text-sm text-[#ff8b8b]">{error}</div> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/92 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Входимо..." : "Увійти"}
            </button>
          </form>

          <p className="mt-6 text-sm text-white/56">
            Ще немає акаунта?{" "}
            <Link to="/auth/register" className="text-white transition hover:text-white/80">
              Створити акаунт
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
