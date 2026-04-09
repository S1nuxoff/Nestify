import React, { useState, useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { getMe, updateProfile, deleteProfile } from "../api/auth";
import { getAvatars } from "../api/utils";
import { hasAccountSession, getCurrentProfile, setCurrentProfile } from "../core/session";
import config from "../core/config";
import "../styles/EditProfilePage.css";

function AvatarPickerPage({ avatars, selected, onSelect, onBack }) {
  const grouped = avatars.reduce((acc, av) => {
    const cat = av.category || "Загальні";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(av);
    return acc;
  }, {});

  const categories = Object.keys(grouped);

  return (
    <div className="ep-avp-root">
      <div className="ep-avp-header">
        <button className="ep-avp-back" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="ep-avp-title">Вибери аватар</h1>
        <div style={{ width: 40 }} />
      </div>
      <div className="ep-avp-content">
        {categories.map((cat) => (
          <div key={cat} className="ep-avp-section">
            <p className="ep-avp-section__title">{cat}</p>
            <div className="ep-avp-section__scroll">
              {grouped[cat].map((av) => (
                <button
                  key={av.filename}
                  className={`ep-avp-item${selected?.filename === av.filename ? " ep-avp-item--active" : ""}`}
                  onClick={() => onSelect(av)}
                >
                  <img src={`${config.backend_url}${av.local_url}`} alt={av.name} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [isKids, setIsKids] = useState(false);
  const [defaultLang, setDefaultLang] = useState("best");
  const [avatars, setAvatars] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!hasAccountSession()) return <Navigate to="/auth/login" replace />;

  useEffect(() => {
    getMe().then((data) => {
      const found = data?.profiles?.find((p) => String(p.id) === String(id));
      if (found) {
        setProfile(found);
        setName(found.name || "");
        setIsKids(found.is_kids || false);
        setDefaultLang(found.default_lang || "best");
      }
    }).catch(() => {});

    getAvatars().then((data) => {
      const list = Array.isArray(data) ? data : [];
      setAvatars(list);
    }).catch(() => {});
  }, [id]);

  // Once we have both profile and avatars, sync selected avatar
  useEffect(() => {
    if (profile && avatars.length) {
      const match = avatars.find((av) => av.local_url === profile.avatar_url);
      setSelectedAvatar(match || null);
    }
  }, [profile, avatars]);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateProfile(id, {
        name: name.trim(),
        avatar_url: selectedAvatar?.local_url || null,
        is_kids: isKids,
        default_lang: defaultLang,
      });
      // Update session if this is the current profile
      const current = getCurrentProfile();
      if (current && String(current.id) === String(id)) {
        setCurrentProfile({ ...current, ...updated });
      }
      navigate(-1);
    } catch (err) {
      setError(err.response?.data?.detail || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteProfile(id);
      const current = getCurrentProfile();
      if (current && String(current.id) === String(id)) {
        setCurrentProfile(null);
      }
      navigate("/account", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Помилка видалення");
      setDeleting(false);
    }
  };

  const avatarSrc = selectedAvatar
    ? `${config.backend_url}${selectedAvatar.local_url}`
    : profile?.avatar_url
    ? `${config.backend_url}${profile.avatar_url}`
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
    <div className="ep-root">
      {/* Header */}
      <div className="ep-header">
        <button className="ep-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="ep-title">Edit Profile</h1>
        <div style={{ width: 40 }} />
      </div>

      {/* Avatar */}
      <div className="ep-avatar-wrap">
        <button className="ep-avatar" onClick={() => setShowPicker(true)}>
          {avatarSrc ? (
            <img src={avatarSrc} alt="avatar" />
          ) : (
            <div className="ep-avatar__placeholder">
              {name ? name[0].toUpperCase() : "?"}
            </div>
          )}
          <div className="ep-avatar__edit">
            <Pencil size={16} />
          </div>
        </button>
        <p className="ep-avatar-name">{name || profile?.name}</p>
      </div>

      {/* Fields */}
      <div className="ep-fields">
        <div className="ep-field-group">
          <label className="ep-field-label">Profile name</label>
          <input
            className="ep-input"
            type="text"
            value={name}
            maxLength={25}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="ep-field-group">
          <label className="ep-field-label">Default torrent language</label>
          <div className="ep-lang-picker">
            {[
              { value: "best", label: "⚡ Best" },
              { value: "uk",   label: "🇺🇦 Ukrainian" },
              { value: "ru",   label: "🇷🇺 Russian" },
              { value: "en",   label: "🇬🇧 English" },
              { value: "pl",   label: "🇵🇱 Polish" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`ep-lang-btn${defaultLang === value ? " ep-lang-btn--on" : ""}`}
                onClick={() => setDefaultLang(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="ep-toggle-row">
          <span className="ep-toggle-label">Kids profile</span>
          <button
            className={`ep-toggle${isKids ? " ep-toggle--on" : ""}`}
            onClick={() => setIsKids((v) => !v)}
          >
            <div className="ep-toggle__thumb" />
          </button>
        </div>
        <p className="ep-toggle-hint">Turn on for kid-friendly content</p>

        {error && <p className="ep-error">{error}</p>}
      </div>

      {/* Delete */}
      <button className="ep-delete" onClick={handleDelete} disabled={deleting}>
        <Trash2 size={16} />
        {deleting ? "Видалення…" : "Delete Profile"}
      </button>

      {/* Save */}
      <div className="ep-bottom">
        <button
          className="ep-save"
          disabled={!name.trim() || saving}
          onClick={handleSave}
        >
          {saving ? "Збереження…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
