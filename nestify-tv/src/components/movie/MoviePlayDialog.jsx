// src/components/movie/MoviePlayDialog.jsx
import React, { useEffect, useRef } from "react";
import VoiceoverOption from "../ui/VoiceoverOption";
import "../../styles/MoviePage.css";
import {
  X,
  Volume2,
  MonitorPlay,
  Tv2,
  Wifi,
  WifiOff,
  BadgeCheck,
} from "lucide-react";

const MoviePlayDialog = ({
  open,
  movieDetails,
  playMode,
  onChangePlayMode,
  playerOnline,
  selectedSeason,
  selectedEpisode,
  selectedTranslatorId,
  onClose,
  onTranslatorClick,
}) => {
  const dialogRef = useRef(null);

  // Signal TV keyboard hook that a dialog is open (Escape = close dialog, not history.back)
  useEffect(() => {
    if (open) {
      document.body.dataset.tvDialogOpen = 'true';
    } else {
      delete document.body.dataset.tvDialogOpen;
    }
    return () => { delete document.body.dataset.tvDialogOpen; };
  }, [open]);

  // When dialog opens, auto-focus first translator button for TV remote
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const first = dialogRef.current?.querySelector('.');
      if (first) first.focus({ preventScroll: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [open]);

  // Close on Escape (TV remote Back button)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !movieDetails) return null;

  const isSeries = movieDetails.action === "get_stream";

  let episodeText = null;
  if (isSeries && (selectedSeason || selectedEpisode)) {
    if (selectedSeason && selectedEpisode)
      episodeText = `Сезон ${selectedSeason} · Серія ${selectedEpisode}`;
    else if (selectedSeason) episodeText = `Сезон ${selectedSeason}`;
    else episodeText = `Серія ${selectedEpisode}`;
  }

  const playModeLabel =
    playMode === "tv" ? "Nestify Player" : "відтворення в браузері";

  return (
    <div className="movie-page__play-dialog-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="movie-page__play-dialog movie-page__play-dialog--pretty"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Вибір озвучки"
      >
        <div className="movie-page__play-dialog-glow" />

        <div className="movie-page__play-dialog-topbar">
          <div className="movie-page__play-dialog-badge">
            <Volume2 size={16} />
            <span>Озвучка</span>
          </div>

          <button
            className="movie-page__play-dialog-x movie-page__play-dialog-x--pretty"
            type="button"
            tabIndex={0}
            onClick={onClose}
            aria-label="Закрити"
          >
            <X size={16} />
          </button>
        </div>

        <div className="movie-page__play-dialog-header">
          <h2 className="movie-page__play-dialog-title">
            Виберіть озвучку{" "}
            <span className="movie-page__play-dialog-title-dot">•</span>
            <span className="movie-page__play-dialog-title-mini">
              {movieDetails.translator_ids?.length || 0}
            </span>
          </h2>

          <p className="movie-page__play-dialog-subtitle">
            {movieDetails.title}
          </p>

          {episodeText && (
            <div className="movie-page__play-dialog-episode-pill">
              <BadgeCheck size={14} />
              <span>{episodeText}</span>
            </div>
          )}

          <div className="movie-page__play-dialog-modes movie-page__play-dialog-modes--pretty">
            <button
              type="button"
              tabIndex={0}
              className={
                "movie-page__play-dialog-mode-btn movie-page__play-dialog-mode-btn--pretty" +
                (playMode === "browser"
                  ? " movie-page__play-dialog-mode-btn--active"
                  : "")
              }
              onClick={() => onChangePlayMode("browser")}
              aria-pressed={playMode === "browser"}
            >
              <MonitorPlay size={16} />
              <span>В браузері</span>
            </button>

            <button
              type="button"
              tabIndex={0}
              className={
                "movie-page__play-dialog-mode-btn movie-page__play-dialog-mode-btn--pretty" +
                (playMode === "tv"
                  ? " movie-page__play-dialog-mode-btn--active"
                  : "") +
                (!playerOnline
                  ? " movie-page__play-dialog-mode-btn--disabled"
                  : "")
              }
              onClick={playerOnline ? () => onChangePlayMode("tv") : undefined}
              aria-pressed={playMode === "tv"}
              title={
                !playerOnline
                  ? "Nestify Player офлайн"
                  : "Запуск у Nestify Player"
              }
            >
              <Tv2 size={16} />
              <span>Nestify Player</span>

              <span
                className={
                  "movie-page__play-dialog-online" +
                  (playerOnline ? " is-online" : " is-offline")
                }
              >
                {playerOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              </span>
            </button>
          </div>
        </div>

        <div className="movie-page__play-dialog-list movie-page__play-dialog-list--pretty">
          {movieDetails.translator_ids?.map((translator) => (
            <button
              key={translator.id}
              className={
                "movie-page__play-dialog-voice-btn" +
                (selectedTranslatorId === translator.id
                  ? " movie-page__play-dialog-voice-btn--selected"
                  : "")
              }
              type="button"
              tabIndex={0}
              onClick={() => onTranslatorClick(translator.id)}
              aria-label={translator.name || translator.id}
              aria-pressed={selectedTranslatorId === translator.id}
            >
              <VoiceoverOption
                translator={translator}
                isSelected={selectedTranslatorId === translator.id}
                onSelect={() => onTranslatorClick(translator.id)}
              />
            </button>
          ))}
        </div>

        <div className="movie-page__play-dialog-footer">
          <span className="movie-page__play-dialog-tip">
            Порада: для серіалів за замовчуванням запускається{" "}
            <strong>1 сезон, 1 епізод</strong>, якщо інше не обрано.
          </span>
        </div>
      </div>
    </div>
  );
};

export default MoviePlayDialog;
