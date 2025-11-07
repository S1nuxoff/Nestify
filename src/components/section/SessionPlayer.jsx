import React from "react";
import SessionPlaybackControls from "../ui/SessionPlaybackControls";
import { ReactComponent as More } from "../../assets/icons/more.svg";

import "swiper/css";
import "../../styles/Player.css";

function SessionPlayer({ session, onMovieSelect }) {
  return (
    <div className="player-container">
      <div className="player-preview-wrapper">
        <div className="preview-overlay"></div>
        <img
          src={session.movie.image}
          alt="Preview"
          className="preview-image"
        />
      </div>

      <div className="player-content">
        <div className="player-content-top">
          <span className="player-status-text">Зараз відтворюється</span>
          <More onClick={() => onMovieSelect(session)} />
        </div>
        <div className="player-content-bottom">
          <div className="player-info" onClick={() => onMovieSelect(session)}>
            <span className="player-title">{session.movie.title}</span>
            <span className="player-sub_title">
              <span className="player-sub_title-origin-name">
                {session.movie.origin_name}
              </span>
              {session.season_id && session.episode_id && (
                <span className="player-sub_title-episodes">
                  | Cезон {session.season_id}, Серія {session.episode_id}{" "}
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
