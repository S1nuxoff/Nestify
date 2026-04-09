import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Tv, Plus, Trash2 } from "lucide-react";
import { updateProfile } from "../api/auth";
import { hasAccountSession, getCurrentProfile, setCurrentProfile } from "../core/session";
import nestifyPlayerClient from "../api/ws/nestifyPlayerClient";
import "../styles/AccountSettingsPage.css";

export default function AccountDevicesPage() {
  const navigate = useNavigate();
  const profile = getCurrentProfile();
  const [isOnline, setIsOnline] = useState(nestifyPlayerClient.isConnected);

  useEffect(() => {
    const handler = (connected) => setIsOnline(connected);
    nestifyPlayerClient.on("connected", handler);
    return () => nestifyPlayerClient.off("connected", handler);
  }, []);

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;
  if (!profile) return <Navigate to="/profiles" replace />;

  const raw = profile?.kodi_address || "";
  const isDeviceCode = /^[0-9A-Za-z]{8}$/.test(raw);
  const deviceCode = isDeviceCode ? raw : null;

  const handleDisconnect = async () => {
    try {
      const updated = await updateProfile(profile.id, { kodi_address: "" });
      setCurrentProfile({ ...profile, ...updated, kodi_address: "" });
      // force re-render by navigating same page
      navigate("/account/devices", { replace: true });
    } catch {}
  };

  return (
    <div className="acc-root" style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", marginBottom: 28, position: "relative" }}>
        <button className="acc-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="acc-title" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", margin: 0 }}>
          Пристрої
        </h1>
      </div>

      <p style={{ alignSelf: "flex-start", fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 400, marginBottom: 8, paddingLeft: 4 }}>
        Підключені пристрої
      </p>

      {deviceCode ? (
        <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Tv size={20} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ fontSize: 15, color: "#fff", margin: 0 }}>Nestify Player</p>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 20,
                  background: isOnline ? "rgba(48,209,88,0.15)" : "rgba(255,255,255,0.07)",
                  color: isOnline ? "#30D158" : "rgba(255,255,255,0.35)",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: isOnline ? "#30D158" : "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                  {isOnline ? "Онлайн" : "Офлайн"}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", margin: "2px 0 0", fontFamily: "monospace", letterSpacing: 1 }}>
                {deviceCode}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center" }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Tv size={32} color="rgba(255,255,255,0.2)" />
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", margin: 0, textAlign: "center" }}>
            Немає підключених пристроїв
          </p>
        </div>
      )}

      <button
        onClick={() => navigate("/connect")}
        style={{
          marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, padding: "13px 16px", borderRadius: 14, border: "1.5px dashed rgba(255,255,255,0.15)",
          background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer",
        }}
      >
        <Plus size={16} />
        {deviceCode ? "Змінити пристрій" : "Підключити ТВ"}
      </button>
    </div>
  );
}
