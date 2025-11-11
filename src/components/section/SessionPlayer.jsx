import React from "react";
import SessionPlaybackControls from "../ui/SessionPlaybackControls";
import { ReactComponent as More } from "../../assets/icons/more.svg";

import "swiper/css";
import "../../styles/Player.css";

function SessionPlayer({ status }) {
  if (!status) return null;

  const title = status.title || "Без назви";
  const originName = status.origin_name || status.originName || title;
  const season = status.season;
  const episode = status.episode;
  const image = status.image;

  const state = status.state || (status.is_playing ? "playing" : "paused");

  const stateText =
    state === "playing"
      ? "Зараз відтворюється"
      : state === "paused"
      ? "На паузі"
      : state === "stopped"
      ? "Зупинено"
      : "Готово";

  return (
    <div className="player-container">
      <div className="player-preview-wrapper">
        <div className="preview-overlay"></div>
        {image && <img src={image} alt="Preview" className="preview-image" />}
      </div>

      <div className="player-content">
        <div className="player-content-top">
          <span className="player-status-text">{stateText}</span>
          <More />
        </div>
        <div className="player-content-bottom">
          <div className="player-info">
            <span className="player-title">{title}</span>
            <span className="player-sub_title">
              <span className="player-sub_title-origin-name">{originName}</span>
              {season != null && episode != null && (
                <span className="player-sub_title-episodes">
                  {" "}
                  | Cезон {season}, Серія {episode}
                </span>
              )}
            </span>
          </div>
          <SessionPlaybackControls />
        </div>
      </div>
    </div>
  );
}

export default SessionPlayer;
