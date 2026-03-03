import React, { useEffect, useState } from "react";
import { Shuffle, Play, RotateCcw, X, ChevronLeft } from "lucide-react";
import "../../styles/PickerSetup.css";
import {
  CONTENT_TYPES,
  GENRES,
  RATING_OPTIONS,
  YEAR_OPTIONS,
  getYearPresetId,
  normalizePickerFilters,
} from "../../core/pickerFilters";

export default function PickerSetupPanel({
  onStart,
  initialFilters = {},
  onClose = null,
  onBack = null,
}) {
  const [contentType, setContentType] = useState(initialFilters.content_type ?? null);
  const [genreId, setGenreId] = useState(initialFilters.genre_id ?? null);
  const [minRating, setMinRating] = useState(initialFilters.min_rating ?? null);
  const [yearPreset, setYearPreset] = useState(getYearPresetId(initialFilters));

  useEffect(() => {
    setContentType(initialFilters.content_type ?? null);
    setGenreId(initialFilters.genre_id ?? null);
    setMinRating(initialFilters.min_rating ?? null);
    setYearPreset(getYearPresetId(initialFilters));
  }, [initialFilters]);

  const resetFilters = () => {
    setContentType(null);
    setGenreId(null);
    setMinRating(null);
    setYearPreset("any");
  };

  const start = (random = false) => {
    if (random) {
      onStart({});
      return;
    }

    const yearOption = YEAR_OPTIONS.find((option) => option.id === yearPreset) || YEAR_OPTIONS[0];
    const filters = normalizePickerFilters({
      content_type: contentType,
      genre_id: genreId,
      min_rating: minRating,
      year_from: yearOption.year_from,
      year_to: yearOption.year_to,
    });

    onStart(filters);
  };

  return (
    <div className="ps-page">
      <div className="ps-inner">
        <section className="ps-hero">
          <div className="ps-head">
            {onBack ? (
              <button className="ps-icon-btn" onClick={onBack} aria-label="Назад">
                <ChevronLeft size={18} />
              </button>
            ) : (
              <div className="ps-icon-btn ps-icon-btn--placeholder" aria-hidden="true" />
            )}
            {onClose ? (
              <button className="ps-icon-btn" onClick={onClose} aria-label="Закрити фільтри">
                <X size={18} />
              </button>
            ) : (
              <div className="ps-icon-btn ps-icon-btn--placeholder" aria-hidden="true" />
            )}
          </div>

          <div className="ps-hero-copy">
            <span className="ps-eyebrow">Персональний підбір</span>
            <h1 className="ps-title">Що сьогодні дивимось?</h1>
            <p className="ps-sub">
              Обери настрій стрічки, а ми зберігатимемо ці параметри для наступних запусків.
            </p>
          </div>
        </section>

        <section className="ps-section">
          <span className="ps-section-label">Тип</span>
          <div className="ps-chips">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={String(ct.value)}
                className={`ps-chip ${contentType === ct.value ? "ps-chip--active" : ""}`}
                onClick={() => setContentType(ct.value)}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </section>

        <section className="ps-section">
          <span className="ps-section-label">Жанр</span>
          <div className="ps-chips">
            {GENRES.map((genre) => (
              <button
                key={String(genre.id)}
                className={`ps-chip ${genreId === genre.id ? "ps-chip--active" : ""}`}
                onClick={() => setGenreId(genre.id)}
              >
                {genre.label}
              </button>
            ))}
          </div>
        </section>

        <section className="ps-section">
          <span className="ps-section-label">Рейтинг TMDB</span>
          <div className="ps-chips">
            {RATING_OPTIONS.map((option) => (
              <button
                key={String(option.value)}
                className={`ps-chip ${minRating === option.value ? "ps-chip--active" : ""}`}
                onClick={() => setMinRating(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="ps-section">
          <span className="ps-section-label">Рік</span>
          <div className="ps-chips">
            {YEAR_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`ps-chip ${yearPreset === option.id ? "ps-chip--active" : ""}`}
                onClick={() => setYearPreset(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <div className="ps-actions">
          <button className="ps-btn ps-btn--ghost" onClick={resetFilters}>
            <RotateCcw size={18} />
            Скинути
          </button>
          <button className="ps-btn ps-btn--random" onClick={() => start(true)}>
            <Shuffle size={18} />
            Рандом
          </button>
          <button className="ps-btn ps-btn--start" onClick={() => start(false)}>
            <Play size={18} fill="currentColor" />
            Показати стрічку
          </button>
        </div>
      </div>
    </div>
  );
}
