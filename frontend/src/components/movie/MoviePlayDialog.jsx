// src/components/movie/MoviePlayDialog.jsx
import React from "react";
import VoiceoverOption from "../ui/VoiceoverOption";
import "../../styles/MoviePage.css";

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
  onTranslatorClick, // (translatorId) => void
}) => {
  if (!open || !movieDetails) return null;

  const playModeLabel =
    playMode === "tv" ? "Nestify Player" : "відтворення в браузері";

  return (
    <div className="movie-page__play-dialog-backdrop" onClick={onClose}>
      <div
        className="movie-page__play-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="movie-page__play-dialog-glow" />

        <div className="movie-page__play-dialog-header-row">
          <div className=""></div>
          <button
            className="movie-page__play-dialog-x"
            type="button"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="movie-page__play-dialog-header">
          <h2 className="movie-page__play-dialog-title">Виберіть озвучку</h2>
          <p className="movie-page__play-dialog-subtitle">
            {movieDetails.title}
          </p>

          {movieDetails.action === "get_stream" &&
            (selectedSeason || selectedEpisode) && (
              <p className="movie-page__play-dialog-episode">
                {selectedSeason && <>Сезон {selectedSeason}</>}
                {selectedSeason && selectedEpisode && " · "}
                {selectedEpisode && <>Серія {selectedEpisode}</>}
              </p>
            )}

          <div className="movie-page__play-dialog-modes">
            <button
              type="button"
              className={
                "movie-page__play-dialog-mode-btn" +
                (playMode === "browser"
                  ? " movie-page__play-dialog-mode-btn--active"
                  : "")
              }
              onClick={() => onChangePlayMode("browser")}
            >
              В браузері
            </button>
            <button
              type="button"
              className={
                "movie-page__play-dialog-mode-btn" +
                (playMode === "tv"
                  ? " movie-page__play-dialog-mode-btn--active"
                  : "") +
                (!playerOnline
                  ? " movie-page__play-dialog-mode-btn--disabled"
                  : "")
              }
              onClick={playerOnline ? () => onChangePlayMode("tv") : undefined}
            >
              Nestify Player
            </button>
          </div>

          <p className="movie-page__play-dialog-helper">
            Натисніть на бажану доріжку — ми одразу запустимо {playModeLabel}.
          </p>
        </div>

        <div className="movie-page__play-dialog-list">
          {movieDetails.translator_ids.map((translator) => (
            <button
              key={translator.id}
              className="movie-page__play-dialog-voice-btn"
              type="button"
              onClick={() => onTranslatorClick(translator.id)}
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
