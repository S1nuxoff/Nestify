import React from "react";
import { Navigate } from "react-router-dom";
import { hasAccountSession } from "../core/session";

const AccountRoute = ({ children }) => {
  if (!hasAccountSession()) {
    return <Navigate to="/auth/login" replace />;
  }

  return children;
};

export default AccountRoute;
