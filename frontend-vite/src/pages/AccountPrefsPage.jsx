import React, { useState, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Check, Zap } from "lucide-react";
import { updateProfile } from "../api/auth";
import { hasAccountSession, getCurrentProfile, setCurrentProfile } from "../core/session";
import "../styles/AccountSettingsPage.css";

const LANGS = [
  { value: "best", icon: <Zap size={18} />,                                                               label: "Найкращі",     hint: "Найбільше сідів з усіх мов" },
  { value: "uk",   icon: <img src="/images/ua.svg" className="w-5 h-5 rounded-full object-cover" />,      label: "Українська",  hint: "Українська озвучка" },
  { value: "ru",   icon: <img src="/images/ru.svg" className="w-5 h-5 rounded-full object-cover" />,      label: "Російська",   hint: "Російська озвучка" },
  { value: "en",   icon: <img src="/images/us.svg" className="w-5 h-5 rounded-full object-cover" />,      label: "Англійська",  hint: "Оригінальна англійська" },
  { value: "pl",   icon: <img src="/images/pl.svg" className="w-5 h-5 rounded-full object-cover" />,      label: "Польська",    hint: "Польська озвучка" },
];

export default function AccountPrefsPage() {
  const navigate = useNavigate();
  const profile = getCurrentProfile();
  const [selected, setSelected] = useState(profile?.default_lang || "best");
  const [saving, setSaving] = useState(false);

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;
  if (!profile) return <Navigate to="/profiles" replace />;

  const handleSelect = useCallback(async (value) => {
    if (saving || value === selected) return;
    setSelected(value);
    setSaving(true);
    try {
      const updated = await updateProfile(profile.id, { default_lang: value });
      setCurrentProfile({ ...profile, ...updated });
    } catch {}
    finally { setSaving(false); }
  }, [profile, selected, saving]);

  return (
    <div className="acc-root" style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", marginBottom: 28, position: "relative" }}>
        <button className="acc-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="acc-title" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", margin: 0 }}>Налаштування</h1>
      </div>

      {/* Section label */}
      <p style={{ alignSelf: "flex-start", fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 400, marginBottom: 8, paddingLeft: 4 }}>
        Мова торентів за замовчуванням
      </p>

      {/* List */}
      <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
        {LANGS.map(({ value, icon, label, hint }, i) => (
          <button
            key={value}
            onClick={() => handleSelect(value)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", background: "transparent", border: "none",
              borderBottom: i < LANGS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
              {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, color: "#fff", margin: 0 }}>{label}</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>{hint}</p>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              border: selected === value ? "none" : "2px solid rgba(255,255,255,0.2)",
              background: selected === value ? "#0A84FF" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
              {selected === value && <Check size={12} strokeWidth={3} color="#fff" />}
            </div>
          </button>
        ))}
      </div>

    </div>
  );
}
