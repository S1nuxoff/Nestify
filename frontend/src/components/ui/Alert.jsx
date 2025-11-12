// src/components/ui/ValidationMessage.js
import React from "react";
import Lottie from "lottie-react";
import ErrorAnimatedIcon from "../../assets/icons/animated/error.json";
// import InfoAnimatedIcon from "../../assets/icons/animated/info.json";
import SuccessAnimatedIcon from "../../assets/icons/animated/success.json";
import "../../styles/Alert.css";
const ICONS = {
  error: ErrorAnimatedIcon,
  //   info: InfoAnimatedIcon,
  success: SuccessAnimatedIcon,
};

export default function Alert({
  visible = false,
  type = "error",
  title = "Ooops..",
  message = "",
}) {
  return (
    <div
      className={`alert-container${visible ? " visible" : ""}`}
      aria-hidden={!visible}
    >
      <Lottie
        className="alert__animated-icon"
        animationData={ICONS[type] || ErrorAnimatedIcon}
        loop
        autoplay
      />
      <div className="alert__content">
        <div className={`alert__title alert__title--${type}`}>{title}</div>

        <div className="alert__subtitle">{message}</div>
      </div>
    </div>
  );
}
