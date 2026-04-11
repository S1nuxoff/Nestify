import React, { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Pencil } from "lucide-react";
import { getAvatars } from "../api/utils";
import { createProfile } from "../api/auth";
import config from "../core/config";
import { hasAccountSession } from "../core/session";
import "../styles/CreateUserPage.css";

function AvatarPickerPage({ avatars, selected, onSelect, onBack }) {
  // Group avatars by category
  const grouped = avatars.reduce((acc, av) => {
    const cat = av.category || "Загальні";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(av);
    return acc;
  }, {});

  const categories = Object.keys(grouped);

  return (
    <div className="avp-root">
      <div className="avp-header">
        <button className="avp-back" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="avp-title">Вибери аватар</h1>
        <div style={{ width: 40 }} />
      </div>

      <div className="avp-content">
        {categories.map((cat) => (
          <div key={cat} className="avp-section">
            <p className="avp-section__title">{cat}</p>
            <div className="avp-section__scroll">
              {grouped[cat].map((av) => (
                <button
                  key={av.filename}
                  className={`avp-item${selected?.filename === av.filename ? " avp-item--active" : ""}`}
                  onClick={() => onSelect(av)}
                >
                  <img
                    src={`${config.backend_url}${av.local_url}`}
                    alt={av.name}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [avatars, setAvatars] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isKids, setIsKids] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;

  useEffect(() => {
    getAvatars().then((data) => {
      setAvatars(Array.isArray(data) ? data : []);
      if (data?.length) setSelectedAvatar(data[0]);
    }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createProfile({
        name: name.trim(),
        avatar_url: selectedAvatar?.local_url || null,
      });
      navigate("/account");
    } catch (err) {
      setError(err.response?.data?.detail || "Помилка створення профілю");
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = selectedAvatar
    ? `${config.backend_url}${selectedAvatar.local_url}`
    : null;

  if (showPicker) {
    return (
      <AvatarPickerPage
        avatars={avatars}
        selected={selectedAvatar}
        onSelect={(av) => { setSelectedAvatar(av); setShowPicker(false); }}
        onBack={() => setShowPicker(false)}
      />
    );
  }

  return (
    <div className="cup-root">
      {/* Header */}
      <div className="cup-header">
        <button className="cup-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="cup-title">Новий профіль</h1>
        <div style={{ width: 40 }} />
      </div>

      {/* Avatar */}
      <div className="cup-avatar-wrap">
        <button className="cup-avatar" onClick={() => setShowPicker(true)}>
          {avatarSrc ? (
            <img src={avatarSrc} alt="avatar" />
          ) : (
            <div className="cup-avatar__placeholder">
              {name ? name[0].toUpperCase() : "?"}
            </div>
          )}
          <div className="cup-avatar__edit">
            <Pencil size={16} />
          </div>
        </button>
        {name && <p className="cup-avatar-name">{name}</p>}
      </div>

      {/* Fields */}
      <div className="cup-fields">
        <input
          className="cup-input"
          type="text"
          placeholder="Ім'я профілю"
          value={name}
          maxLength={25}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="cup-toggle-row">
          <span className="cup-toggle-label">Дитячий профіль</span>
          <button
            className={`cup-toggle${isKids ? " cup-toggle--on" : ""}`}
            onClick={() => setIsKids((v) => !v)}
          >
            <div className="cup-toggle__thumb" />
          </button>
        </div>
        <p className="cup-toggle-hint">Вмикає контент лише для дітей</p>

        {error && <p className="cup-error">{error}</p>}
      </div>

      {/* Create button */}
      <div className="cup-bottom">
        <button
          className="cup-create"
          disabled={!name.trim() || saving}
          onClick={handleCreate}
        >
          {saving ? "Створення…" : "Створити"}
        </button>
      </div>
    </div>
  );
}
