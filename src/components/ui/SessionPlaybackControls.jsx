import React, { useState, useEffect, useRef, useCallback } from "react";
import { ReactComponent as PlayerPlayIcon } from "../../assets/icons/player_play.svg";
import { ReactComponent as PlayerPauseIcon } from "../../assets/icons/player_pause.svg";
import { ReactComponent as PlayerBackwardIcon } from "../../assets/icons/player_backward.svg";
import { ReactComponent as PlayerForwardIcon } from "../../assets/icons/player_forward.svg";
import { ReactComponent as PlayerVolumeuIcon } from "../../assets/icons/player_volume.svg";
import { ReactComponent as PlayerStop } from "../../assets/icons/player_stop.svg";
import "../../styles/PlayerPlaybackControls.css";
import usePlayerStatus from "../../hooks/usePlayerStatus";
import nestifyPlayerClient from "../../api/ws/nestifyPlayerClient";

const formatTime = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

const ProgressBar = ({
  className,
  sliderValue,
  min,
  max,
  gradient,
  onChange,
  onMouseDown,
  onMouseUp,
  onTouchStart,
  onTouchEnd,
  currentSec,
  durationSec,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipTime, setTooltipTime] = useState(0);
  const [tooltipLeft, setTooltipLeft] = useState(0);
  const sliderRef = useRef();

  const handleInput = (e) => {
    const value = parseFloat(e.target.value);
    const percent = value / 100;
    const time = Math.floor(percent * durationSec);
    setTooltipTime(time);
    setShowTooltip(true);

    const rect = sliderRef.current.getBoundingClientRect();
    const relativeX = (value / 100) * rect.width;
    setTooltipLeft(relativeX);

    onChange(e);
  };

  const hideTooltip = () => setShowTooltip(false);

  return (
    <div className="seek-bar-container" style={{ position: "relative" }}>
      <input
        ref={sliderRef}
        type="range"
        className={className}
        min={min}
        max={max}
        value={sliderValue}
        onChange={handleInput}
        onMouseDown={(e) => {
          setShowTooltip(true);
          onMouseDown(e);
        }}
        onMouseUp={(e) => {
          hideTooltip();
          onMouseUp(e);
        }}
        onTouchStart={(e) => {
          setShowTooltip(true);
          onTouchStart(e);
        }}
        onTouchEnd={(e) => {
          hideTooltip();
          onTouchEnd(e);
        }}
        style={{ background: gradient }}
      />
      <span className="time-label">{formatTime(currentSec)}</span>
      {showTooltip && (
        <div
          className="tooltip"
          style={{
            top: "-30px",
            left: tooltipLeft,
            transform: "translateX(-50%)",
          }}
        >
          {formatTime(tooltipTime)}
        </div>
      )}
    </div>
  );
};

function SessionPlaybackControls() {
  const { status } = usePlayerStatus();

  const [sliderValue, setSliderValue] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const isDraggingRef = useRef(false);
  const sliderRef = useRef(null);

  const currentSec = status ? Math.floor((status.position_ms || 0) / 1000) : 0;
  const durationSec = status
    ? Math.max(0, Math.floor((status.duration_ms || 0) / 1000))
    : 0;

  const min = 0;
  const max = 100;

  const gradient = `linear-gradient(to right,
    var(--red) 0%,
    var(--red) ${sliderValue}%,
    rgba(217, 217, 217, 50%) ${sliderValue}%,
    rgba(217, 217, 217, 50%)`;

  useEffect(() => {
    if (!status) return;

    setIsPlaying(status.is_playing || status.state === "playing");
    setVolume(status.volume ?? 50);

    if (!isDraggingRef.current && durationSec > 0) {
      const newPercent = (currentSec / durationSec) * 100;
      setSliderValue(newPercent);
    } else if (!isDraggingRef.current && durationSec === 0) {
      setSliderValue(0);
    }
  }, [status, currentSec, durationSec]);

  const handlePlayPause = useCallback(() => {
    nestifyPlayerClient.playPause();
  }, []);

  const handleRewind = useCallback(() => {
    nestifyPlayerClient.seekBySeconds(-10);
  }, []);

  const handleForward = useCallback(() => {
    nestifyPlayerClient.seekBySeconds(10);
  }, []);

  const handleStop = useCallback(() => {
    nestifyPlayerClient.stop();
  }, []);

  const handleSliderChange = useCallback((e) => {
    setSliderValue(parseInt(e.target.value, 10));
  }, []);

  const handleSliderMouseDown = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleSliderMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    if (durationSec > 0) {
      const newPositionSec = Math.floor((sliderValue / 100) * durationSec);
      const newMs = newPositionSec * 1000;
      nestifyPlayerClient.seekMs(newMs);
    }
  }, [durationSec, sliderValue]);

  const handleVolumeIconClick = useCallback(() => {
    setShowVolumeSlider((prev) => !prev);
  }, []);

  const updateVolumeFromPointer = useCallback((e) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left; // горизонталь вместо вертикали
    const newValue = clickX / rect.width; // 0 -> 1 слева направо
    const clamped = Math.max(0, Math.min(newValue, 1));
    const newVolume = Math.round(clamped * 100);
    setVolume(newVolume);
    nestifyPlayerClient.setVolume(newVolume);
  }, []);

  const handlePointerMove = useCallback(
    (e) => {
      e.preventDefault();
      updateVolumeFromPointer(e);
    },
    [updateVolumeFromPointer]
  );

  const handlePointerUpWrapper = useCallback(
    (e) => {
      e.preventDefault();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUpWrapper);
    },
    [handlePointerMove]
  );

  const handlePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      updateVolumeFromPointer(e);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUpWrapper);
    },
    [updateVolumeFromPointer, handlePointerMove, handlePointerUpWrapper]
  );

  useEffect(() => {
    if (showVolumeSlider) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showVolumeSlider]);

  return (
    <>
      {showVolumeSlider && (
        <div
          className="volume-overlay"
          onClick={() => setShowVolumeSlider(false)}
        >
          <div
            className="volume-slider"
            ref={sliderRef}
            style={{ "--value": volume / 100 }}
            onPointerDown={handlePointerDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="volume-track-bg"></div>
            <div className="volume-track-fill"></div>
            {/* проценты прямо на ползунке */}
            <div className="volume-tooltip">{Math.round(volume)}%</div>
          </div>
        </div>
      )}

      <div className="player-controls-container">
        <div className="seek-section">
          <ProgressBar
            className="seek-bar"
            sliderValue={sliderValue}
            min={min}
            max={max}
            gradient={gradient}
            onChange={handleSliderChange}
            onMouseDown={handleSliderMouseDown}
            onMouseUp={handleSliderMouseUp}
            onTouchStart={handleSliderMouseDown}
            onTouchEnd={handleSliderMouseUp}
            currentSec={currentSec}
            durationSec={durationSec}
          />
        </div>

        <div className="player-controls-items">
          <PlayerStop
            className="player-icon"
            onClick={handleStop}
            style={{ cursor: "pointer", width: 32, height: 32 }}
          />
          <div className="player-controls-center">
            <PlayerBackwardIcon
              onClick={handleRewind}
              style={{ cursor: "pointer" }}
            />
            {isPlaying ? (
              <PlayerPauseIcon
                onClick={handlePlayPause}
                style={{ cursor: "pointer" }}
              />
            ) : (
              <PlayerPlayIcon
                onClick={handlePlayPause}
                style={{ cursor: "pointer" }}
              />
            )}
            <PlayerForwardIcon
              onClick={handleForward}
              style={{ cursor: "pointer" }}
            />
          </div>
          <PlayerVolumeuIcon
            onClick={handleVolumeIconClick}
            style={{ cursor: "pointer" }}
          />
        </div>
      </div>
    </>
  );
}

export default SessionPlaybackControls;
