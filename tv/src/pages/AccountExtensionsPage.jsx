import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Copy, X } from "lucide-react";
import { addExtensionByLink, getExtensions, getExtensionSettings, saveExtensionSettings, setExtensionInstalled } from "../api/plugins";
import { hasAccountSession } from "../core/session";
import "../styles/AccountSettingsPage.css";

const errorText = (e) => e?.response?.data?.detail || "Не вдалося. Спробуйте ще раз.";

const WARN_DAYS = 5;
const DAY = 24 * 60 * 60;

// Коротко про стан плагіна: для адміністратора, щоб помітити проблему раніше за інших.
function statusLine(status) {
  if (!status) return null;
  if (status.ok === false) return { text: status.message || "Не працює", bad: true };
  if (!status.expires_at) return status.ok ? { text: status.message } : null;
  const days = Math.ceil((status.expires_at - Date.now() / 1000) / DAY);
  if (days <= 0) return { text: "Куки закінчились", bad: true };
  const date = new Date(status.expires_at * 1000).toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  return { text: days <= WARN_DAYS ? `Куки закінчуються через ${days} дн.` : `Куки дійсні до ${date}`, bad: days <= WARN_DAYS };
}

function SettingsDialog({ item, onClose, onSaved }) {
  const [settings, setSettings] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    getExtensionSettings(item.id).then(setSettings).catch((e) => setError(errorText(e)));
  }, [item.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      setSettings(await saveExtensionSettings(item.id, values));
      setValues({});
      await onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const copy = async (command, index) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(index);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Не вдалося скопіювати. Виділіть команду вручну.");
    }
  };

  const status = statusLine(settings?.status);
  const canSave = settings?.fields?.some((f) => values[f.key]?.trim());

  // У body, щоб вікно було над нижньою панеллю і поза масштабом сторінки на великих екранах.
  return createPortal(
    <div className="ext-dialog__backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ext-dialog" role="dialog" aria-modal="true" aria-label={`Налаштування ${item.name}`}>
        <header className="ext-dialog__head">
          <h2>{item.name}</h2>
          <button type="button" className="ext-dialog__close" onClick={onClose} aria-label="Закрити"><X size={20} /></button>
        </header>

        {status && <p className={`ext-dialog__status${status.bad ? " ext-dialog__status--bad" : ""}`}>{status.text}</p>}
        {!settings && !error && <p className="ext-dialog__status">Завантаження…</p>}

        {settings?.help?.length > 0 && (
          <ol className="ext-dialog__steps">
            {settings.help.map((step, i) => (
              <li key={i}>
                {step.text}
                {step.command && (
                  <span className="ext-dialog__command">
                    <code>{step.command}</code>
                    <button type="button" onClick={() => copy(step.command, i)} aria-label="Скопіювати команду">
                      {copied === i ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}

        {settings?.fields?.length > 0 && (
          <form onSubmit={save} className="ext-dialog__form">
            {settings.fields.map((field) => (
              <textarea
                key={field.key}
                rows={3}
                aria-label={field.label}
                placeholder={field.placeholder || field.label}
                value={values[field.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                spellCheck={false}
                autoComplete="off"
              />
            ))}
            {error && <p className="ext-error">{error}</p>}
            <button type="submit" className="ext__install" disabled={!canSave || saving}>
              {saving ? "Перевіряємо…" : "Перевірити й зберегти"}
            </button>
          </form>
        )}
        {!settings && error && <p className="ext-error">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}

function Extension({ item, busy, onChange, onConfigure }) {
  const installed = item.state === "installed";
  const status = statusLine(item.status);
  return (
    <article className={`ext${item.state === "soon" ? " ext--soon" : ""}`}>
      <div className="ext__tile">
        <span className="ext__logo">{item.name}</span>
        {installed && <span className="ext__badge" title="Встановлено"><Check size={16} strokeWidth={3} /></span>}
      </div>
      <p className="ext__text">{item.description}</p>
      {status && <p className={`ext__status${status.bad ? " ext__status--bad" : ""}`}>{status.text}</p>}
      <div className="ext__action">
        {item.state === "available" && (
          <button type="button" className="ext__install" disabled={busy} onClick={() => onChange(item, true)}>Встановити</button>
        )}
        {installed && (
          <button type="button" className="ext__remove" disabled={busy} onClick={() => onChange(item, false)}>Видалити</button>
        )}
        {item.configurable && (
          <button type="button" className="ext__settings" onClick={() => onConfigure(item)}>Налаштувати</button>
        )}
        {item.state === "builtin" && <span className="ext__note">Вбудовано в Nestify</span>}
        {item.state === "soon" && <span className="ext__note">Скоро</span>}
      </div>
    </article>
  );
}

export default function AccountExtensionsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [link, setLink] = useState("");
  const [token, setToken] = useState("");
  const [configuring, setConfiguring] = useState(null);

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
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="acc-root acc-root--full">
      <div className="acc-page acc-page--wide">
        <button className="acc-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={22} /> Профіль
        </button>
        <h1 className="acc-headline">Розширення</h1>

        {error && <p className="ext-error">{error}</p>}

        {!loading && items.length > 0 && (
          <div className="ext-grid">
            {items.map((item) => (
              <Extension key={item.id} item={item} busy={busyId === item.id} onChange={change} onConfigure={setConfiguring} />
            ))}
          </div>
        )}

        {!loading && isAdmin && (
          formOpen ? (
            <form onSubmit={addByLink} className="ext-form">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Посилання на manifest.json" aria-label="Посилання на manifest.json" autoFocus />
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Токен, якщо потрібен" aria-label="Токен" type="password" autoComplete="off" />
              <div className="ext-form__actions">
                <button type="submit" className="ext__install" disabled={!link.trim() || busyId === "link"}>Додати</button>
                <button type="button" className="ext__remove" onClick={() => setFormOpen(false)}>Скасувати</button>
              </div>
            </form>
          ) : (
            <button type="button" className="ext-add" onClick={() => setFormOpen(true)}>Додати за посиланням</button>
          )
        )}
      </div>
      {configuring && <SettingsDialog item={configuring} onClose={() => setConfiguring(null)} onSaved={load} />}
    </div>
  );
}
