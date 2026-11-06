import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/Global.css";
import "./styles/LargeScreens.css";
import { BrowserRouter } from "react-router-dom";
import { installDragScroll } from "./core/dragScroll";

installDragScroll();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  // <React.StrictMode>
  <BrowserRouter>
    <App />
  </BrowserRouter>
  // </React.StrictMode>
);
