import React from "react";
import { Navigate } from "react-router-dom";
import { hasAccountSession, hasSelectedProfile } from "../core/session";

const PrivateRoute = ({ children }) => {
  if (!hasAccountSession()) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!hasSelectedProfile()) {
    return <Navigate to="/profiles" replace />;
  }

  return children;
};

export default PrivateRoute;
