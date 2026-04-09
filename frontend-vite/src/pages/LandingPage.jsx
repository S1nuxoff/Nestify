import React from "react";
import { Link } from "react-router-dom";

const highlights = [
  "Один акаунт для родини, окремі профілі для кожного.",
  "Продовження перегляду та вподобання не змішуються між профілями.",
  "Фільми, серіали, аніме та персональні добірки в одному місці.",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07090d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(67,119,255,0.2),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(33,211,140,0.14),transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between py-4">
          <div className="text-2xl font-semibold tracking-[0.22em] text-white/95">
            NESTIFY
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/auth/login"
              className="rounded-full border border-white/12 px-5 py-2 text-sm font-medium text-white/88 transition hover:border-white/20 hover:text-white"
            >
              Увійти
            </Link>
            <Link
              to="/auth/register"
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Реєстрація
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center py-16 sm:py-24">
          <div className="grid w-full gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <section className="max-w-2xl">
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.24em] text-white/65">
                Streaming for profiles
              </span>
              <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                Один акаунт. Кілька профілів. Свій Nestify для кожного.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/68 sm:text-lg">
                Замість загального екрана з усіма користувачами буде нормальний
                старт: лендинг, реєстрація по email і вибір профілю на кшталт
                Netflix.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/auth/register"
                  className="rounded-full bg-[#1ed760] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#38e474]"
                >
                  Створити акаунт
                </Link>
                <Link
                  to="/auth/login"
                  className="rounded-full border border-white/12 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/8"
                >
                  У мене вже є акаунт
                </Link>
              </div>
            </section>

            <section className="grid gap-4 self-center">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm"
                >
                  <div className="text-sm leading-6 text-white/80">{item}</div>
                </div>
              ))}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
