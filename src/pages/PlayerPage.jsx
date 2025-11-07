import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { ReactComponent as BackIcon } from "../assets/icons/player_back_icon.svg";

import "../styles/Player.css";
import { getProgress, saveProgress } from "../api/hdrezka/progressApi";

export default function PlayerPage() {
  /* входные данные */
  const { state } = useLocation();
  const { selectedEpisode, selectedSeason, movieDetails, movie_url } =
    state ?? {};
  const userId = JSON.parse(localStorage.getItem("current_user"))?.id;

  /* refs + state */
  const videoNodeRef = useRef(null); // DOM-<video>
  const playerRef = useRef(null); // video.js Player inst
  const timerRef = useRef(null);
  const [startPos, setStartPos] = useState(null);
  const navigate = useNavigate();
  console.log(movieDetails);
  useEffect(() => {
    if (!movieDetails || !movie_url) return;
    (async () => {
      const { position_seconds } = await getProgress({
        user_id: userId,
        movie_id: movieDetails.id,
        season: selectedSeason ?? null,
        episode: selectedEpisode ?? null,
      });
      setStartPos(position_seconds || 0);
    })();
  }, [userId, movieDetails, movie_url, selectedSeason, selectedEpisode]);

  /* 2. init video.js once */
  useEffect(() => {
    const node = videoNodeRef.current;
    if (!node) return;
    playerRef.current = videojs(node, {
      controls: true,
      preload: "auto",
      autoplay: false,
    });

    return () => {
      playerRef.current?.dispose();
    };
  }, []);

  /* 3. после готовности плеера + позиции — seek + mute + play + SAVE */
  useEffect(() => {
    const p = playerRef.current;
    if (!p || startPos === null) return;

    const run = () => {
      p.muted(true); // обход autoplay
      p.currentTime(startPos);
      p.play().then(() => setTimeout(() => p.muted(false), 400));
    };

    p.readyState() > 0 ? run() : p.one("loadedmetadata", run);

    /* ── сохранение прогресса ── */
    const save = () => {
      // Не отправлять прогресс, если видео на паузе (для таймера)
      if (p.paused()) return;
      saveProgress({
        user_id: userId,
        movie_id: movieDetails.id,
        position_seconds: Math.floor(p.currentTime()),
        season: selectedSeason ?? null,
        episode: selectedEpisode ?? null,
      });
    };

    // На паузу и перемотку — сохраняем сразу (даже если paused)
    const saveAlways = () => {
      saveProgress({
        user_id: userId,
        movie_id: movieDetails.id,
        position_seconds: Math.floor(p.currentTime()),
        season: selectedSeason ?? null,
        episode: selectedEpisode ?? null,
      });
    };

    p.on("pause", saveAlways);
    p.on("seeked", saveAlways);
    timerRef.current = setInterval(save, 30_000);

    return () => {
      // 1️⃣ считываем позицию напрямую из DOM-видео,
      //    пока Video.js ещё не уничтожил его
      const rawTime = videoNodeRef.current?.currentTime;
      if (rawTime != null) {
        saveProgress({
          user_id: userId,
          movie_id: movieDetails.id,
          position_seconds: Math.floor(rawTime),
          season: selectedSeason ?? null,
          episode: selectedEpisode ?? null,
        });
      }

      // 2️⃣ снимаем подписки и таймер
      p.off("pause", saveAlways);
      p.off("seeked", saveAlways);
      clearInterval(timerRef.current);

      // 3️⃣ уничтожаем плеер
      p.dispose();
    };
  }, [startPos, userId, movieDetails, selectedSeason, selectedEpisode]);

  /* 4. Горячие клавиши */
  useEffect(() => {
    const handleKeyDown = (e) => {
      const player = playerRef.current;
      if (!player) return;
      // Игнорируем если сейчас вводим в input/textarea
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          document.activeElement.isContentEditable)
      ) {
        return;
      }
      switch (e.code) {
        case "Space":
        case "Spacebar":
          e.preventDefault();
          player.paused() ? player.play() : player.pause();
          break;
        case "ArrowRight":
          e.preventDefault();
          player.currentTime(player.currentTime() + 10);
          break;
        case "ArrowLeft":
          e.preventDefault();
          player.currentTime(Math.max(0, player.currentTime() - 10));
          break;
        case "ArrowUp":
          e.preventDefault();
          player.volume(Math.min(1, player.volume() + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          player.volume(Math.max(0, player.volume() - 0.1));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!movieDetails || !movie_url)
    return (
      <div className="container">
        <div className="web-player-container_error">
          <div className="web-player-container_error-content">
            <h2>Ooops.. 404</h2>
            <p>
              Не вдалося завантажити дані для цього фільму. Можливо, сторінку
              було відкрито напрям
            </p>
            <button
              onClick={() => navigate("/")}
              className="web-player-container_error-btn"
            >
              <BackIcon />
              На головну
            </button>
          </div>
        </div>
        <div className="background-blur-100"></div>
        <div className="background-glow-center-red"></div>
      </div>
    );

  return (
    <>
      <div className="web-player-container">
        <div className="web-player-top">
          <BackIcon
            className="player-back_icon"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/")}
          />
          <span className="web-player_title">{movieDetails.title}</span>
        </div>
        <video
          ref={videoNodeRef}
          className="video-js vjs-custom-theme"
          src={movie_url}
          playsInline
        />
      </div>
    </>
  );
}
