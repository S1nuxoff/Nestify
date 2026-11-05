import React, { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Puzzle } from "lucide-react";
import { addExtensionByLink, getExtensions, setExtensionInstalled } from "../api/plugins";
import { hasAccountSession } from "../core/session";
import "../styles/AccountSettingsPage.css";

const card = { width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 16, overflow: "hidden", marginBottom: 16 };
const muted = { fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.4 };
const heading = { alignSelf: "flex-start", fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 8px 4px" };
const pill = { border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const primary = { ...pill, background: "#fff", color: "#000" };
const secondary = { ...pill, background: "rgba(255,255,255,0.1)", color: "#fff" };
const input = {
  width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 10,
  padding: "11px 12px", color: "#fff", fontSize: 14, marginBottom: 8,
};

const STATE_LABEL = { builtin: "Вбудовано", soon: "Скоро" };
const errorText = (e) => e?.response?.data?.detail || "Не вдалося. Спробуйте ще раз.";

function ExtensionRow({ item, last, busy, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "14px 16px",
      borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Puzzle size={16} color="rgba(255,255,255,0.6)" />
      </div>
      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
        <p style={{ fontSize: 15, color: "#fff", margin: "0 0 2px" }}>{item.name}</p>
        <p style={muted}>{item.description}</p>
      </div>
      {item.state === "available" && (
        <button type="button" tabIndex={0} style={primary} disabled={busy} onClick={() => onChange(item, true)}>Встановити</button>
      )}
      {item.state === "installed" && (
        <button type="button" tabIndex={0} style={secondary} disabled={busy} onClick={() => onChange(item, false)}>Видалити</button>
      )}
      {STATE_LABEL[item.state] && <span style={muted}>{STATE_LABEL[item.state]}</span>}
    </div>
  );
}

export default function AccountExtensionsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [link, setLink] = useState("");
  const [token, setToken] = useState("");

  const load = useCallback(async () => {
    const data = await getExtensions();
    setItems(data.items || []);
    setIsAdmin(Boolean(data.is_admin));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(errorText(e))).finally(() => setLoading(false));
  }, [load]);

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;

  const change = async (item, installed) => {
    setBusyId(item.id);
    setError(null);
    try {
      await setExtensionInstalled(item.id, installed);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  const addByLink = async (event) => {
    event.preventDefault();
    setBusyId("link");
    setError(null);
    try {
      await addExtensionByLink(link.trim(), token.trim());
      setLink("");
      setToken("");
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="acc-root" style={{ paddingBottom: 100 }}>
      <div style={{ width: "100%", display: "flex", alignItems: "center", marginBottom: 28 }}>
        <button className="acc-back-btn" onClick={() => navigate(-1)} aria-label="Назад">
          <ChevronLeft size={20} />
        </button>
        <h1 className="acc-title" style={{ flex: 1, margin: 0, paddingRight: 36, textAlign: "center" }}>
          Розширення
        </h1>
      </div>

      {loading && <p style={{ ...muted, textAlign: "center", marginTop: 40 }}>Завантаження…</p>}
      {error && <p style={{ ...muted, color: "#ff8a80", alignSelf: "flex-start", marginBottom: 12 }}>{error}</p>}

      {!loading && items.length > 0 && (
        <>
          <p style={heading}>Працює на всіх профілях цього акаунту</p>
          <div style={card}>
            {items.map((item, i) => (
              <ExtensionRow key={item.id} item={item} last={i === items.length - 1} busy={busyId === item.id} onChange={change} />
            ))}
          </div>
        </>
      )}

      {!loading && isAdmin && (
        <>
          <p style={heading}>Додати за посиланням</p>
          <form onSubmit={addByLink} style={{ ...card, padding: 16 }}>
            <input style={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="http://…/manifest.json" aria-label="Посилання на manifest.json" />
            <input style={input} value={token} onChange={(e) => setToken(e.target.value)} placeholder="Токен (якщо потрібен)" aria-label="Токен" type="password" autoComplete="off" />
            <button type="submit" style={primary} disabled={!link.trim() || busyId === "link"}>Додати</button>
          </form>
        </>
      )}
    </div>
  );
}
