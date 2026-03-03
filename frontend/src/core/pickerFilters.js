export const PICKER_FILTERS_STORAGE_KEY = "picker_filters_v2";

export const CONTENT_TYPES = [
  { value: null, label: "Усе" },
  { value: "film", label: "Фільм" },
  { value: "series", label: "Серіал" },
  { value: "cartoon", label: "Мультфільм" },
  { value: "anime", label: "Аніме" },
];

export const GENRES = [
  { id: null, label: "Будь-який" },
  { id: 28, label: "Бойовик" },
  { id: 12, label: "Пригоди" },
  { id: 16, label: "Анімація" },
  { id: 35, label: "Комедія" },
  { id: 80, label: "Кримінал" },
  { id: 99, label: "Документальний" },
  { id: 18, label: "Драма" },
  { id: 10751, label: "Сімейний" },
  { id: 14, label: "Фентезі" },
  { id: 36, label: "Історичний" },
  { id: 27, label: "Жахи" },
  { id: 10402, label: "Музика" },
  { id: 9648, label: "Містика" },
  { id: 10749, label: "Романтика" },
  { id: 878, label: "Фантастика" },
  { id: 53, label: "Трилер" },
  { id: 10752, label: "Воєнний" },
  { id: 37, label: "Вестерн" },
];

export const RATING_OPTIONS = [
  { value: null, label: "Будь-який" },
  { value: 6, label: "6.0+" },
  { value: 7, label: "7.0+" },
  { value: 8, label: "8.0+" },
];

export const YEAR_OPTIONS = [
  { id: "any", label: "Будь-який", year_from: null, year_to: null },
  { id: "2020_plus", label: "2020+", year_from: 2020, year_to: null },
  { id: "2015_plus", label: "2015+", year_from: 2015, year_to: null },
  { id: "2010s", label: "2010-2019", year_from: 2010, year_to: 2019 },
  { id: "2000s", label: "2000-2009", year_from: 2000, year_to: 2009 },
  { id: "90s", label: "1990-1999", year_from: 1990, year_to: 1999 },
  { id: "classic", label: "До 1990", year_from: null, year_to: 1989 },
];

export function normalizePickerFilters(filters = {}) {
  const next = {};

  if (filters.content_type) next.content_type = filters.content_type;
  if (Number.isInteger(filters.genre_id)) next.genre_id = filters.genre_id;
  if (typeof filters.min_rating === "number" && Number.isFinite(filters.min_rating)) {
    next.min_rating = filters.min_rating;
  }
  if (Number.isInteger(filters.year_from)) next.year_from = filters.year_from;
  if (Number.isInteger(filters.year_to)) next.year_to = filters.year_to;

  return next;
}

export function getYearPresetId(filters = {}) {
  const yearFrom = Number.isInteger(filters.year_from) ? filters.year_from : null;
  const yearTo = Number.isInteger(filters.year_to) ? filters.year_to : null;

  const matched = YEAR_OPTIONS.find(
    (option) => option.year_from === yearFrom && option.year_to === yearTo
  );

  return matched?.id || "any";
}

export function loadSavedPickerFilters() {
  try {
    const raw = localStorage.getItem(PICKER_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    return normalizePickerFilters(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePickerFilters(filters = {}) {
  const normalized = normalizePickerFilters(filters);
  localStorage.setItem(PICKER_FILTERS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
