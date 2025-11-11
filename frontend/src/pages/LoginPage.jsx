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
    navigate("/"); // 👈 или другой нужный путь
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
        <h2 className="login-title">Who's watching?</h2>
        <div className="login-users-list">
          {users.map((user) => (
            <UserLoginCard
              key={user.id}
              name={user.name}
              image={`${config.backend_url}${user.avatar_url}`}
              onUserSelect={() => handleUserSelect(user)}
            />
          ))}
          <div onClick={handleAddUser} className="login-create-user">
            <PlusIcon />
          </div>
        </div>
      </div>
      <div className="background-blur-100"></div>
      <div className="background-glow-center-green"></div>
    </div>
  );
}

export default LoginPage;
