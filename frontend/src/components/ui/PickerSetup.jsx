import React, { useState } from "react";
import { Shuffle, Play } from "lucide-react";
import "../../styles/PickerSetup.css";

const CONTENT_TYPES = [
  { value: null,      label: "Все" },
  { value: "film",    label: "Фільм" },
  { value: "series",  label: "Серіал" },
  { value: "cartoon", label: "Мульт" },
  { value: "anime",   label: "Аніме" },
];

const GENRES = [
  { id: null,  label: "Будь-який" },
  { id: 28,    label: "Екшн" },
  { id: 35,    label: "Комедія" },
  { id: 27,    label: "Жахи" },
  { id: 53,    label: "Трилер" },
  { id: 18,    label: "Драма" },
  { id: 10749, label: "Мелодрама" },
  { id: 878,   label: "Фантастика" },
  { id: 12,    label: "Пригоди" },
  { id: 14,    label: "Фентезі" },
  { id: 9648,  label: "Детектив" },
  { id: 99,    label: "Документальний" },
];

export default function PickerSetup({ onStart }) {
  const [contentType, setContentType] = useState(null);
  const [genreId, setGenreId] = useState(null);

  const start = (random = false) => {
    if (random) {
      onStart({});
    } else {
      const filters = {};
      if (contentType) filters.content_type = contentType;
      if (genreId !== null) filters.genre_id = genreId;
      onStart(filters);
    }
  };

  return (
    <div className="ps-page">
      <div className="ps-inner">
        <h1 className="ps-title">Що дивимось?</h1>
        <p className="ps-sub">Обери фільтри або запусти рандом</p>

        {/* Content type */}
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

        {/* Genre */}
        <section className="ps-section">
          <span className="ps-section-label">Жанр</span>
          <div className="ps-chips">
            {GENRES.map((g) => (
              <button
                key={String(g.id)}
                className={`ps-chip ${genreId === g.id ? "ps-chip--active" : ""}`}
                onClick={() => setGenreId(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="ps-actions">
          <button className="ps-btn ps-btn--random" onClick={() => start(true)}>
            <Shuffle size={18} />
            Рандом
          </button>
          <button className="ps-btn ps-btn--start" onClick={() => start(false)}>
            <Play size={18} fill="currentColor" />
            Почати
          </button>
        </div>
      </div>
    </div>
  );
}
