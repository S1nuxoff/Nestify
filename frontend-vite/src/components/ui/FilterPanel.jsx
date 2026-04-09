import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import CategorySelector from "./CategorySelector";
import "../../styles/FilterPanel.css";

const CATEGORIES = [
  { key: "all", label: "Все" },
  { key: "movie", label: "Фільми" },
  { key: "tv", label: "Серіали" },
  { key: "animation", label: "Анімація" },
];

export const GENRES = [
  { id: "28", name: "Бойовик" },
  { id: "18", name: "Драма" },
  { id: "35", name: "Комедія" },
  { id: "53", name: "Трилер" },
  { id: "27", name: "Жахи" },
  { id: "878", name: "Фантастика" },
  { id: "12", name: "Пригоди" },
  { id: "16", name: "Анімація" },
  { id: "10749", name: "Мелодрама" },
  { id: "80", name: "Кримінал" },
  { id: "14", name: "Фентезі" },
  { id: "99", name: "Документальний" },
  { id: "10752", name: "Воєнний" },
  { id: "37", name: "Вестерн" },
  { id: "36", name: "Історичний" },
  { id: "10751", name: "Сімейний" },
];

export const COUNTRIES = [
  { id: "US", name: "США" },
  { id: "GB", name: "Велика Британія" },
  { id: "FR", name: "Франція" },
  { id: "DE", name: "Німеччина" },
  { id: "JP", name: "Японія" },
  { id: "KR", name: "Корея" },
  { id: "IT", name: "Італія" },
  { id: "ES", name: "Іспанія" },
  { id: "CA", name: "Канада" },
  { id: "AU", name: "Австралія" },
  { id: "IN", name: "Індія" },
  { id: "CN", name: "Китай" },
  { id: "UA", name: "Україна" },
  { id: "PL", name: "Польща" },
  { id: "SE", name: "Швеція" },
  { id: "DK", name: "Данія" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1969 }, (_, i) => CURRENT_YEAR - i);

const SORT_OPTIONS = [
  { id: "popularity.desc", label: "Популярні" },
  { id: "release_date.desc", label: "Нові" },
  { id: "vote_average.desc", label: "За рейтингом" },
];

export default function FilterPanel({ initial, onApply, onClose }) {
  const [filters, setFilters] = useState({
    mediaType: "all",
    genres: [],
    countries: [],
    yearMin: null,
    yearMax: null,
    ratingMin: 0,
    ratingMax: 10,
    sortBy: "popularity.desc",
    ...initial,
  });

  // sub-panel: null | "genre" | "country" | "year"
  const [subPanel, setSubPanel] = useState(null);

  const update = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  const toggleItem = (key, id) => {
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
    }));
  };

  const handleRatingMin = (e) => {
    const val = Number(e.target.value);
    if (val <= filters.ratingMax) update("ratingMin", val);
  };

  const handleRatingMax = (e) => {
    const val = Number(e.target.value);
    if (val >= filters.ratingMin) update("ratingMax", val);
  };

  const handleReset = () => {
    setFilters({
      mediaType: "all",
      genres: [],
      countries: [],
      yearMin: null,
      yearMax: null,
      ratingMin: 0,
      ratingMax: 10,
      sortBy: "popularity.desc",
    });
  };

  // Genre summary text
  const genreSummary = () => {
    if (!filters.genres.length) return "Всі";
    const names = filters.genres
      .map((id) => GENRES.find((g) => g.id === id)?.name)
      .filter(Boolean);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  };

  const countrySummary = () => {
    if (!filters.countries.length) return "Всі";
    const names = filters.countries
      .map((id) => COUNTRIES.find((c) => c.id === id)?.name)
      .filter(Boolean);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 1).join(", ")} +${names.length - 1}`;
  };

  const yearSummary = () => {
    if (!filters.yearMin && !filters.yearMax) return "Всі";
    if (filters.yearMin && filters.yearMax) return `${filters.yearMin}–${filters.yearMax}`;
    if (filters.yearMin) return `від ${filters.yearMin}`;
    return `до ${filters.yearMax}`;
  };

  // Sub-panel list renderer
  const renderSubPanel = (title, items, selectedKey, onToggle, multi = true) => (
    <div className="fp-subpanel">
      <div className="fp-header">
        <button className="fp-back" onClick={() => setSubPanel(null)}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="fp-title">{title}</h2>
        <div style={{ width: 40 }} />
      </div>
      <div className="fp-sublist">
        {items.map((item) => {
          const isActive = multi
            ? filters[selectedKey].includes(item.id)
            : filters[selectedKey] === item.id;
          return (
            <button
              key={item.id}
              className={`fp-subrow${isActive ? " fp-subrow--active" : ""}`}
              onClick={() =>
                multi ? onToggle(selectedKey, item.id) : update(selectedKey, item.id)
              }
            >
              <span>{item.name || item.id}</span>
              {isActive && <Check size={16} className="fp-check" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Year sub-panel
  const renderYearPanel = () => (
    <div className="fp-subpanel">
      <div className="fp-header">
        <button className="fp-back" onClick={() => setSubPanel(null)}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="fp-title">Рік</h2>
        <div style={{ width: 40 }} />
      </div>
      <div className="fp-year-ranges">
        <button
          className={`fp-subrow${
            !filters.yearMin && !filters.yearMax ? " fp-subrow--active" : ""
          }`}
          onClick={() => {
            update("yearMin", null);
            update("yearMax", null);
          }}
        >
          <span>Всі</span>
          {!filters.yearMin && !filters.yearMax && (
            <Check size={16} className="fp-check" />
          )}
        </button>
        {[
          { label: "2020-і", min: 2020, max: null },
          { label: "2010-і", min: 2010, max: 2019 },
          { label: "2000-і", min: 2000, max: 2009 },
          { label: "1990-і", min: 1990, max: 1999 },
          { label: "1980-і", min: 1980, max: 1989 },
          { label: "до 1980", min: null, max: 1979 },
        ].map((range) => {
          const isActive =
            filters.yearMin === range.min && filters.yearMax === range.max;
          return (
            <button
              key={range.label}
              className={`fp-subrow${isActive ? " fp-subrow--active" : ""}`}
              onClick={() => {
                update("yearMin", range.min);
                update("yearMax", range.max);
              }}
            >
              <span>{range.label}</span>
              {isActive && <Check size={16} className="fp-check" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fp-overlay">
      <div className={`fp-panel${subPanel ? " fp-panel--sub" : ""}`}>
        {subPanel === "genre" &&
          renderSubPanel("Жанр", GENRES, "genres", toggleItem, true)}
        {subPanel === "country" &&
          renderSubPanel("Країна", COUNTRIES, "countries", toggleItem, true)}
        {subPanel === "year" && renderYearPanel()}

        {!subPanel && (
          <>
            <div className="fp-header">
              <button className="fp-back" onClick={onClose}>
                <ChevronLeft size={24} />
              </button>
              <h2 className="fp-title">Фільтри</h2>
              <div style={{ width: 40 }} />
            </div>

            <div className="fp-body">
              {/* Category */}
              <CategorySelector
                categories={CATEGORIES}
                active={filters.mediaType}
                onChange={(v) => update("mediaType", v)}
              />

              {/* Filter rows */}
              <div className="fp-section-label">Фільтри</div>
              <div className="fp-rows">
                <button className="fp-row" onClick={() => setSubPanel("genre")}>
                  <span className="fp-row__label">Жанр</span>
                  <span className="fp-row__value">
                    {genreSummary()} <ChevronRight size={16} />
                  </span>
                </button>
                <button className="fp-row" onClick={() => setSubPanel("country")}>
                  <span className="fp-row__label">Країна</span>
                  <span className="fp-row__value">
                    {countrySummary()} <ChevronRight size={16} />
                  </span>
                </button>
                <button className="fp-row" onClick={() => setSubPanel("year")}>
                  <span className="fp-row__label">Рік</span>
                  <span className="fp-row__value">
                    {yearSummary()} <ChevronRight size={16} />
                  </span>
                </button>
              </div>

              {/* Rating */}
              <div className="fp-rows">
                <div className="fp-row fp-row--rating">
                  <div className="fp-row__top">
                    <span className="fp-row__label">Рейтинг</span>
                    <span className="fp-row__value-plain">
                      Від {filters.ratingMin} до {filters.ratingMax}
                    </span>
                  </div>
                  <div className="fp-range-wrap">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={filters.ratingMin}
                      onChange={handleRatingMin}
                      className="fp-range fp-range--min"
                    />
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={filters.ratingMax}
                      onChange={handleRatingMax}
                      className="fp-range fp-range--max"
                    />
                    <div className="fp-range-track">
                      <div
                        className="fp-range-fill"
                        style={{
                          left: `${filters.ratingMin * 10}%`,
                          right: `${(10 - filters.ratingMax) * 10}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sort */}
              <div className="fp-section-label">Сортувати</div>
              <div className="fp-rows">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`fp-row fp-row--radio${
                      filters.sortBy === opt.id ? " fp-row--radio-active" : ""
                    }`}
                    onClick={() => update("sortBy", opt.id)}
                  >
                    <span className="fp-row__label">{opt.label}</span>
                    <span
                      className={`fp-radio${
                        filters.sortBy === opt.id ? " fp-radio--active" : ""
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom actions */}
            <div className="fp-actions">
              <button className="fp-btn fp-btn--reset" onClick={handleReset}>
                Скинути
              </button>
              <button
                className="fp-btn fp-btn--apply"
                onClick={() => onApply(filters)}
              >
                Застосувати
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
