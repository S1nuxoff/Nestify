import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Mail, User, Shield, Calendar } from "lucide-react";
import { getMe } from "../api/auth";
import { hasAccountSession } from "../core/session";
import "../styles/AccountSettingsPage.css";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("uk-UA", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AccountPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((data) => setAccount(data?.account || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;

  const rows = account ? [
    { icon: Mail,     label: "Email",        value: account.email },
    { icon: User,     label: "Ім'я",         value: account.display_name || "—" },
    { icon: Shield,   label: "Статус",       value: account.is_active ? "Активний" : "Неактивний" },
    { icon: Calendar, label: "Дата реєстрації", value: formatDate(account.created_at) },
  ] : [];

  return (
    <div className="acc-root" style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", marginBottom: 28, position: "relative" }}>
        <button className="acc-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="acc-title" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", margin: 0 }}>
          Акаунт
        </h1>
      </div>

      {loading && (
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center", marginTop: 40 }}>
          Завантаження…
        </div>
      )}

      {!loading && account && (
        <>
          <p style={{ alignSelf: "flex-start", fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 400, marginBottom: 8, paddingLeft: 4 }}>
            Дані акаунту
          </p>
          <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            {rows.map(({ icon: Icon, label, value }, i) => (
              <div
                key={label}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px",
                  borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color="rgba(255,255,255,0.6)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0, marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 15, color: "#fff", margin: 0, wordBreak: "break-all" }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
