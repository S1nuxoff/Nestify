import React, { useState, useEffect } from "react";
import "../styles/CreateUser.css";
import { getAvatars } from "../api/utils";
import { createUser } from "../api/user";
import { useNavigate } from "react-router-dom";
import config from "../core/config";
function CreateUserPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [avatars, setAvatars] = useState([]);
  const [page, setPage] = useState(0);
  const avatarsPerPage = 4;

  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        const data = await getAvatars();
        setAvatars(data);
      } catch (err) {
        console.error("Failed to load avatars", err);
      }
    };

    fetchAvatars();
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    if (value.length <= 25) {
      setName(value);
      setError(
        value.length > 20 ? "Please enter no more than 20 characters" : ""
      );
    }
  };

  const handleNextStep1 = () => {
    if (name.trim().length === 0 || name.trim().length > 20) return;
    setStep(2);
  };

  const handleNextStep2 = async () => {
    if (name.trim() && name.length <= 20 && selectedAvatar) {
      try {
        const response = await createUser({
          name: name.trim(),
          avatar_url: selectedAvatar.local_url,
        });

        // 👉 Перейти, например, на главную или на профиль
        navigate("/login"); // или `/profile/${response.id}`
      } catch (err) {
        console.error("❌ Створення користувача не вдалося:", err);
      }
    }
  };

  const handleAvatarSelect = (avatar) => {
    setSelectedAvatar(avatar);
  };

  const startIndex = page * avatarsPerPage;
  const visibleAvatars = avatars.slice(startIndex, startIndex + avatarsPerPage);

  const handleNextPage = () => {
    const maxPage = Math.floor(avatars.length / avatarsPerPage);
    if (page < maxPage) setPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (page > 0) setPage((prev) => prev - 1);
  };

  return (
    <>
      <div className="create-user__container">
        <div className="create-user__content">
          {step === 1 && (
            <>
              <div className="create-user-text">
                <h2 className="create-user__title">Setting up new User</h2>
                <span>Name your Profile</span>
              </div>
              <div className="create-user__input-container">
                <input
                  type="text"
                  placeholder="Marcin"
                  className={`create-user__input ${error ? "error" : ""}`}
                  value={name}
                  onChange={handleChange}
                />
                {error && <div className="create-user__error">{error}</div>}
              </div>
              <div
                className={`create-user__next-btn ${
                  name.trim() && name.length <= 20 ? "active" : ""
                }`}
                onClick={handleNextStep1}
              >
                Next
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="create-user-text">
                <h2 className="create-user__title">Choose Avatar</h2>
                <span>Pick one for {name}</span>
              </div>
              <div className="crete-user__avatar-selector">
                <div className="avatar-selection-grid">
                  {visibleAvatars.map((avatar) => (
                    <img
                      key={avatar.filename}
                      src={`${config.backend_url}${avatar.local_url}`}
                      alt={avatar.name}
                      className={`avatar-option ${
                        selectedAvatar?.filename === avatar.filename
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => handleAvatarSelect(avatar)}
                    />
                  ))}
                </div>
                <div className="avatar-pagination-controls">
                  <button onClick={handlePrevPage} disabled={page === 0}>
                    Back
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={startIndex + avatarsPerPage >= avatars.length}
                  >
                    Next
                  </button>
                </div>
              </div>
              <div
                className={`create-user__next-btn ${
                  name.trim() && name.length <= 20 && selectedAvatar
                    ? "active"
                    : ""
                }`}
                onClick={handleNextStep2}
              >
                Finish
              </div>
            </>
          )}
        </div>
      </div>

      <div className="background-blur-100"></div>
      <div className="background-glow-center-green"></div>
    </>
  );
}

export default CreateUserPage;
