import React from "react";
import "../../styles/UserLoginCard.css";

function UserLoginCard({ image, name, onUserSelect }) {
  return (
    <div className="user-login__container">
      <div onClick={onUserSelect} className="user-login__avatar-container">
        <img
          src={image}
          className="user-login-avatar"
          alt="user-login-avatar"
        />
      </div>
      <span className="user-login-name">{name}</span>
    </div>
  );
}

export default UserLoginCard;
