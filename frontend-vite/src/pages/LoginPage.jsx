import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "../styles/Login.css";
import UserLoginCard from "../components/ui/UserLoginCard";
import PlusIcon from "../assets/icons/plus.svg?react";
import { getMe } from "../api/auth";
import config from "../core/config";
import {
  clearAuthSession,
  hasAccountSession,
  hasSelectedProfile,
  setCurrentProfile,
} from "../core/session";

function LoginPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  if (!hasAccountSession()) {
    return <Navigate to="/auth/login" replace />;
  }

  if (hasSelectedProfile()) {
    return <Navigate to="/" replace />;
  }

  const handleAddUser = () => {
    navigate("/profiles/new");
  };

  const handleUserSelect = (user) => {
    setCurrentProfile(user);
    navigate("/");
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getMe();
        setUsers(Array.isArray(data?.profiles) ? data.profiles : []);
      } catch (err) {
        clearAuthSession();
        setError("Сесія завершилась. Увійди ще раз.");
        console.error("❌ Failed to load users:", err);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div className="container">
      <div className="login-container">
        <h2 className="login-title">Who&apos;s watching?</h2>
        {error ? <div className="mt-4 text-sm text-[#ff8b8b]">{error}</div> : null}

        <div className="login-users-list">
          {users.map((user) => (
            <div
              key={user.id}
              className="login-user-card-wrapper tv-focusable"
              tabIndex={0}
              role="button"
              aria-label={user.name}
              onClick={() => handleUserSelect(user)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleUserSelect(user);
                }
              }}
            >
              <UserLoginCard
                name={user.name}
                image={`${config.backend_url}${user.avatar_url}`}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddUser}
            className="login-create-user login-user-card-wrapper tv-focusable"
            tabIndex={0}
            aria-label="Додати користувача"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="background-blur-100" />
      <div className="background-glow-center" />
    </div>
  );
}

export default LoginPage;
