import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/Global.css";
import { BrowserRouter } from "react-router-dom";
import { androidNotifyReady } from "./api/AndroidBridge";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  // <React.StrictMode>
  <BrowserRouter>
    <App />
  </BrowserRouter>
  // </React.StrictMode>
);

// Tell the native WebView that the React app has mounted
androidNotifyReady();
