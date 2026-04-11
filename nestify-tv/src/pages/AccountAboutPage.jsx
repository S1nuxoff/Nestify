import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Zap, Shield, Tv, Globe } from "lucide-react";
import { hasAccountSession } from "../core/session";
import logoUrl from "../assets/icons/logo.svg";
import "../styles/AccountSettingsPage.css";

const FEATURES = [
  { icon: Zap,    text: "Миттєвий пошук і стрімінг через торент" },
  { icon: Tv,     text: "Трансляція на телевізор через Nestify Player" },
  { icon: Shield, text: "Без реклами, без обмежень" },
  { icon: Globe,  text: "Фільми та серіали з усього світу" },
];

export default function AccountAboutPage() {
  const navigate = useNavigate();

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;

  return (
    <div className="acc-root" style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", marginBottom: 28, position: "relative" }}>
        <button className="acc-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="acc-title" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", margin: 0 }}>
          Про сервіс
        </h1>
      </div>

      {/* Logo + version */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 32 }}>
        <img src={logoUrl} alt="Nestify" style={{ height: 36, objectFit: "contain" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", letterSpacing: 0.5 }}>Beta</span>
      </div>

      {/* Description */}
      <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "16px", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.6 }}>
          Nestify — це приватний медіасервіс для перегляду фільмів і серіалів у зручному форматі. Ми агрегуємо контент із відкритих джерел і надаємо зручний інтерфейс для пошуку, перегляду та управління переглядами.
        </p>
      </div>

      {/* Features */}
      <p style={{ alignSelf: "flex-start", fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 400, marginBottom: 8, paddingLeft: 4 }}>
        Можливості
      </p>
      <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }}>
        {FEATURES.map(({ icon: Icon, text }, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
              borderBottom: i < FEATURES.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={16} color="rgba(255,255,255,0.6)" />
            </div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: 0 }}>{text}</p>
          </div>
        ))}
      </div>

      {/* Legal */}
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center", lineHeight: 1.6, marginTop: 8 }}>
        Nestify не зберігає і не розповсюджує захищений контент.{"\n"}Усі матеріали надаються з відкритих торент-джерел.
      </p>
    </div>
  );
}
