import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { registerAccount } from "../api/auth";
import { hasAccountSession, hasSelectedProfile, setAuthSession } from "../core/session";

export default function AuthRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    profile_name: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (hasAccountSession()) {
    return <Navigate to={hasSelectedProfile() ? "/" : "/profiles"} replace />;
  }

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const data = await registerAccount(form);
      setAuthSession({
        token: data.access_token,
        account: data.account,
        profile: data.selected_profile || null,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Не вдалося створити акаунт");
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
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Створити акаунт
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/62">
            Email та пароль для акаунта. Ім&apos;я профілю створимо одразу.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/28 focus:border-white/20"
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Пароль</span>
              <input
                type="password"
                value={form.password}
                onChange={handleChange("password")}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/28 focus:border-white/20"
                placeholder="Мінімум 8 символів"
                minLength={8}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-white/70">
                Ім&apos;я першого профілю
              </span>
              <input
                type="text"
                value={form.profile_name}
                onChange={handleChange("profile_name")}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-white/28 focus:border-white/20"
                placeholder="Наприклад, Vadym"
                maxLength={20}
                required
              />
            </label>

            {error ? <div className="text-sm text-[#ff8b8b]">{error}</div> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-[#1ed760] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#38e474] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Створюємо..." : "Створити акаунт"}
            </button>
          </form>

          <p className="mt-6 text-sm text-white/56">
            Вже є акаунт?{" "}
            <Link to="/auth/login" className="text-white transition hover:text-white/80">
              Увійти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
