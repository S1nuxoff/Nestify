import React, { useState, useEffect, useRef } from "react";
import { ReactComponent as PlayIcon } from "../../assets/icons/play.svg";
import { ReactComponent as VolumeMute } from "../../assets/icons/volume-mute.svg";
import { ReactComponent as VolumeOne } from "../../assets/icons/volume-one.svg";
import { ReactComponent as TheMovieDbLogo } from "../../assets/icons/themoviedb_logo.svg";
import ReactPlayer from "react-player/youtube";
import "../../styles/Player.css";

function FeaturedCard({ onMovieSelect, movie, isActive, resetTrigger }) {
  const [isMuted, setIsMuted] = useState(true);
  const [posterVisible, setPosterVisible] = useState(true);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);
  const [isVisible, setIsVisible] = useState(true); // 👈 нове

  const wrapperRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => {
      if (wrapperRef.current) observer.unobserve(wrapperRef.current);
    };
  }, []);

  useEffect(() => {
    setIsMuted(true);
  }, [resetTrigger]);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    setContentVisible((prev) => !prev);
  };

  useEffect(() => {
    if (isActive && movie?.trailer) {
      setPosterVisible(true);
      setTrailerVisible(false);
      setContentVisible(true);

      const hidePosterTimer = setTimeout(() => setPosterVisible(false), 5000);
      const showTrailerTimer = setTimeout(() => setTrailerVisible(true), 6000);

      return () => {
        clearTimeout(hidePosterTimer);
        clearTimeout(showTrailerTimer);
      };
    } else {
      setPosterVisible(true);
      setTrailerVisible(false);
      setContentVisible(true);
    }
  }, [isActive, movie?.trailer]);

  return (
    <div
      className={`continue-container ${!isMuted ? "unmuted" : ""}`}
      ref={wrapperRef}
    >
      <div className="player-preview-wrapper">
        <div
          style={{
            opacity: contentVisible ? 1 : 0,
            transition: "opacity 0.6s ease-in-out",
          }}
          className="continue-overlay"
        />

        {movie?.trailer && isActive ? (
          <>
            {trailerVisible && (
              <div className="continue-volume-btn" onClick={toggleMute}>
                {isMuted ? (
                  <VolumeMute className="continue-volume-icon" />
                ) : (
                  <VolumeOne className="continue-volume-icon" />
                )}
              </div>
            )}

            <div className="youtube-player-container">
              <img
                src={movie.image}
                alt="Preview"
                className="preview-image"
                style={{
                  opacity: posterVisible ? 1 : 0,
                  transition: "opacity 1s ease-in-out",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",

                  zIndex: 2,
                }}
              />

              {trailerVisible && (
                <ReactPlayer
                  url={movie.trailer}
                  playing={isVisible && isActive} // 👈 залежить від скролу
                  muted={isMuted}
                  controls={false}
                  loop
                  width="100%"
                  height="100%"
                  className="youtube-player"
                  style={{
                    transition: "opacity 1s ease-in-out",
                    opacity: 1,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 1,
                  }}
                  config={{
                    youtube: {
                      playerVars: {
                        autoplay: 1,
                        modestbranding: 1,
                        rel: 0,
                        controls: 0,
                        showinfo: 0,
                        fs: 0,
                        disablekb: 1,
                      },
                    },
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <img
            src={movie.image}
            alt="Preview"
            className="preview-image"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
      </div>

      <div
        className="continue-content"
        style={{
          opacity: contentVisible ? 1 : 0,
          transition: "opacity 0.6s ease-in-out",
        }}
      >
        <div className="continue-content-top">
          {/* <span className="continue-status-text">Зараз у Тренді</span> */}
          {/* <TheMovieDbLogo className="themoviedb-logo" /> */}

          <a className="themoviedb-logo" href="https://www.themoviedb.org/">
            TMDB
          </a>
        </div>
        <span></span>
        <div className="continue-content-bottom">
          <div className="continue-titles">
            <span className="continue-title">{movie?.title}</span>
            <span className="continue-origin_name">
              {movie?.origin_name || movie.title}
            </span>
          </div>

          <div className="continue-info">
            <div className="continue-sub_title">
              {movie?.age && (
                <span className="continue-sub_age">{movie.age}</span>
              )}
              <span className="continue-sub_title-genre">
                {movie?.genre?.[0]}
              </span>
              <div className="continue-sub_title">
                <span className="continue-sub_title-release_date">
                  {movie?.release_date}
                </span>
                <span className="continue-sub_title-duration">
                  {movie?.duration}
                </span>
              </div>
            </div>
            <span className="continue_description">{movie?.description}</span>
          </div>

          <div
            className="continue__play-button"
            onClick={() => onMovieSelect(movie)}
          >
            <PlayIcon /> Дивитися
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeaturedCard;
