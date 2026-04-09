import React, { useEffect, useState, useCallback } from "react";
import "../styles/Global.css";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Eye, EyeOff, Check } from "lucide-react";
import { getAdminSettings, patchAdminSettings } from "../api/admin";
import { getCurrentProfile } from "../core/session";

const GROUPS = ["Jackett", "JacRed", "TorrServe", "Rezka"];

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-[31px] w-[51px] flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        value ? "bg-[#0A84FF]" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-[27px] w-[27px] transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          value ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

function TextField({ value, onChange, type = "text" }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="relative">
      <input
        type={isPassword && !show ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-right text-[15px] text-white/90 focus:outline-none pr-1 placeholder-white/20"
        style={{ minWidth: 0, maxWidth: 220 }}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="ml-2 text-white/30 hover:text-white/60 transition-colors"
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      )}
    </div>
  );
}

function SettingRow({ setting, value, onChange, isLast }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3 ${!isLast ? "border-b border-white/[0.06]" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] text-white leading-tight">{setting.label}</p>
      </div>
      <div className="flex-shrink-0 flex items-center">
        {setting.type === "bool" ? (
          <Toggle value={!!value} onChange={onChange} />
        ) : (
          <TextField value={value ?? ""} onChange={onChange} type={setting.type} />
        )}
      </div>
    </div>
  );
}

function SettingsGroup({ title, settings: groupSettings, values, onChange }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-white/40 uppercase tracking-wider px-1 mb-2">
        {title}
      </p>
      <div className="rounded-2xl overflow-hidden bg-white/[0.06] border border-white/[0.07]">
        {groupSettings.map((s, i) => (
          <SettingRow
            key={s.key}
            setting={s}
            value={values[s.key] ?? s.value}
            onChange={(v) => onChange(s.key, v)}
            isLast={i === groupSettings.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const profile = getCurrentProfile();
  if (profile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <p className="text-white/30 text-[15px]">Access denied</p>
      </div>
    );
  }

  useEffect(() => {
    getAdminSettings()
      .then((data) => {
        setSettings(data);
        const vals = {};
        data.forEach((s) => { vals[s.key] = s.value; });
        setValues(vals);
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = useCallback((key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await patchAdminSettings(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  }, [values]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/8 hover:bg-white/12 transition-colors text-white/70"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-[17px] font-semibold tracking-tight">Settings</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[14px] font-medium transition-all disabled:opacity-40 ${
              saved
                ? "bg-green-500/15 text-green-400"
                : "bg-[#0A84FF] text-white hover:bg-[#0A84FF]/80"
            }`}
          >
            {saved ? <><Check size={13} strokeWidth={2.5} /> Saved</> : saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="bg-red-500/10 border border-red-500/15 rounded-xl px-4 py-3 text-red-400 text-[14px]">
            {error}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-7">
        {loading ? (
          <div className="text-center text-white/20 text-[15px] py-20">Loading…</div>
        ) : (
          GROUPS.map((group) => {
            const groupSettings = settings.filter((s) => s.group === group);
            if (!groupSettings.length) return null;
            return (
              <SettingsGroup
                key={group}
                title={group}
                settings={groupSettings}
                values={values}
                onChange={handleChange}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
