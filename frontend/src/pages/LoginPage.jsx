import React, { useEffect, useState } from "react";
import "../styles/Login.css";
import UserLoginCard from "../components/ui/UserLoginCard";
import { ReactComponent as PlusIcon } from "../assets/icons/plus.svg";
import { useNavigate } from "react-router-dom";
import { getUsers } from "../api/utils";
import config from "../core/config";

function LoginPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);

  const handleAddUser = () => {
    navigate("/login/create/user");
  };

  const handleUserSelect = (user) => {
    localStorage.setItem("current_user", JSON.stringify(user));
    navigate("/");
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getUsers();
        setUsers(data);
      } catch (err) {
        console.error("❌ Failed to load users:", err);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div className="container">
      <div className="login-container">
        <h2 className="login-title">Who&apos;s watching?</h2>

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
