import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import "../../styles/FilterPanel.css";

const CATEGORIES = [
  { key: "all",       label: "Все"      },
  { key: "movie",     label: "Фільми"   },
  { key: "tv",        label: "Серіали"  },
  { key: "animation", label: "Анімація" },
];

export const GENRES = [
  { id: "28",    name: "Бойовик"        },
  { id: "18",    name: "Драма"          },
  { id: "35",    name: "Комедія"        },
  { id: "53",    name: "Трилер"         },
  { id: "27",    name: "Жахи"           },
  { id: "878",   name: "Фантастика"     },
  { id: "12",    name: "Пригоди"        },
  { id: "16",    name: "Анімація"       },
  { id: "10749", name: "Мелодрама"      },
  { id: "80",    name: "Кримінал"       },
  { id: "14",    name: "Фентезі"        },
  { id: "99",    name: "Документальний" },
  { id: "10752", name: "Воєнний"        },
  { id: "37",    name: "Вестерн"        },
  { id: "36",    name: "Історичний"     },
  { id: "10751", name: "Сімейний"       },
];

export const COUNTRIES = [
  { id: "US", name: "США"             },
  { id: "GB", name: "Велика Британія" },
  { id: "FR", name: "Франція"         },
  { id: "DE", name: "Німеччина"       },
  { id: "JP", name: "Японія"          },
  { id: "KR", name: "Корея"           },
  { id: "IT", name: "Італія"          },
  { id: "ES", name: "Іспанія"         },
  { id: "CA", name: "Канада"          },
  { id: "AU", name: "Австралія"       },
  { id: "IN", name: "Індія"           },
  { id: "CN", name: "Китай"           },
  { id: "UA", name: "Україна"         },
  { id: "PL", name: "Польща"          },
  { id: "SE", name: "Швеція"          },
  { id: "DK", name: "Данія"           },
];

const SORT_OPTIONS = [
  { id: "popularity.desc",   label: "Популярні"    },
  { id: "release_date.desc", label: "Нові"         },
  { id: "vote_average.desc", label: "За рейтингом" },
];

const RATING_OPTIONS = [
  { id: "__any__", label: "Будь-який", min: 0,  max: 10 },
  { id: "5plus",   label: "5+",        min: 5,  max: 10 },
  { id: "6plus",   label: "6+",        min: 6,  max: 10 },
  { id: "7plus",   label: "7+",        min: 7,  max: 10 },
  { id: "8plus",   label: "8+",        min: 8,  max: 10 },
  { id: "9plus",   label: "9+",        min: 9,  max: 10 },
];

const BACK_CODES  = new Set([8, 27, 461, 10009, 88]);
const ENTER_CODES = new Set([13, 29443, 65385, 117]);
const UP_CODES    = new Set([38, 29460]);
const DOWN_CODES  = new Set([40, 29461]);
const LEFT_CODES  = new Set([37, 4]);
const RIGHT_CODES = new Set([39, 5]);

export default function FilterPanel({ initial, onApply, onClose }) {
  const [sliding, setSliding] = useState(false);
  const [filters, setFilters] = useState({
    mediaType: "all",
    genres:    [],
    countries: [],
    yearMin:   null,
    yearMax:   null,
    ratingMin: 0,
    ratingMax: 10,
    sortBy:    "popularity.desc",
    ...initial,
  });

  const [subPanel, setSubPanel] = useState(null);
  // zones: "cats" | "main" | "actions"
  const [zone, setZone]         = useState("main");
  const [zoneIdx, setZoneIdx]   = useState(0);
  const panelRef    = useRef(null);
  const catRefs     = useRef([]);
  const mainRefs    = useRef([]);
  const actionRefs  = useRef([]);

  // ── Define closePanel BEFORE the effects that reference it ───────────────
  const closePanel = useCallback(() => {
    setSliding(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  // Lock body scroll + flag for spatial nav + intercept Android back button
  useEffect(() => {
    document.body.classList.add("filter-panel-open");
    // Push a history entry so Android TV back button fires popstate instead of navigating
    window.history.pushState({ filterPanel: true }, "");
    const onPopState = () => closePanel();
    window.addEventListener("popstate", onPopState);
    return () => {
      document.body.classList.remove("filter-panel-open");
      window.removeEventListener("popstate", onPopState);
    };
  }, [closePanel]);

  // Slide-in on mount + initial focus
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setSliding(true);
      setTimeout(() => mainRefs.current[0]?.focus({ preventScroll: true }), 80);
    }));
  }, []);

  const update     = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const toggleItem = (key, id)  => setFilters((f) => ({
    ...f,
    [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
  }));

  // ── Summaries ─────────────────────────────────────────────────────────────
  const genreSummary = () => {
    if (!filters.genres.length) return "Всі";
    const names = filters.genres.map((id) => GENRES.find((g) => g.id === id)?.name).filter(Boolean);
    return names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  };
  const countrySummary = () => {
    if (!filters.countries.length) return "Всі";
    const names = filters.countries.map((id) => COUNTRIES.find((c) => c.id === id)?.name).filter(Boolean);
    return names.length <= 1 ? names.join(", ") : `${names[0]} +${names.length - 1}`;
  };
  const yearSummary = () => {
    if (!filters.yearMin && !filters.yearMax) return "Всі";
    if (filters.yearMin && filters.yearMax) return `${filters.yearMin}–${filters.yearMax}`;
    return filters.yearMin ? `від ${filters.yearMin}` : `до ${filters.yearMax}`;
  };
  const ratingSummary = () => {
    if (filters.ratingMin === 0) return "Будь-який";
    return `${filters.ratingMin}+`;
  };

  const handleReset = () => setFilters({
    mediaType: "all", genres: [], countries: [], yearMin: null, yearMax: null,
    ratingMin: 0, ratingMax: 10, sortBy: "popularity.desc",
  });

  // ── Scroll element to top of its nearest overflow container ─────────────
  const scrollToTop = (el) => {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (node.scrollHeight > node.clientHeight &&
          (style.overflowY === "auto" || style.overflowY === "scroll")) {
        const delta = el.getBoundingClientRect().top - node.getBoundingClientRect().top;
        node.scrollTop += delta;
        return;
      }
      node = node.parentElement;
    }
  };

  // ── Zone-based focus helpers ──────────────────────────────────────────────
  const focusZone = useCallback((z, idx) => {
    const refs = z === "cats" ? catRefs : z === "actions" ? actionRefs : mainRefs;
    const arr = refs.current.filter(Boolean);
    const clamped = Math.max(0, Math.min(idx, arr.length - 1));
    const el = arr[clamped];
    if (el) {
      el.focus({ preventScroll: true });
      scrollToTop(el);
    }
    setZone(z);
    setZoneIdx(clamped);
  }, []);

  // ── Sub-panel items ───────────────────────────────────────────────────────
  const subItems = () => {
    if (subPanel === "genre")   return GENRES;
    if (subPanel === "country") return COUNTRIES;
    if (subPanel === "rating")  return RATING_OPTIONS;
    if (subPanel === "year")    return [
      { id: "__all__", name: "Всі"      },
      { id: "2020s",   name: "2020-і",  min: 2020, max: null },
      { id: "2010s",   name: "2010-і",  min: 2010, max: 2019 },
      { id: "2000s",   name: "2000-і",  min: 2000, max: 2009 },
      { id: "1990s",   name: "1990-і",  min: 1990, max: 1999 },
      { id: "1980s",   name: "1980-і",  min: 1980, max: 1989 },
      { id: "pre1980", name: "до 1980", min: null, max: 1979  },
    ];
    return [];
  };

  const isSubItemActive = (item) => {
    if (subPanel === "genre")   return filters.genres.includes(item.id);
    if (subPanel === "country") return filters.countries.includes(item.id);
    if (subPanel === "rating")  return filters.ratingMin === (item.min ?? 0);
    if (subPanel === "year") {
      if (item.id === "__all__") return !filters.yearMin && !filters.yearMax;
      return filters.yearMin === (item.min ?? null) && filters.yearMax === (item.max ?? null);
    }
    return false;
  };

  const toggleSub = (item) => {
    if (subPanel === "genre")   { toggleItem("genres", item.id); return; }
    if (subPanel === "country") { toggleItem("countries", item.id); return; }
    if (subPanel === "rating") {
      update("ratingMin", item.min ?? 0);
      update("ratingMax", item.max ?? 10);
      return;
    }
    if (subPanel === "year") {
      if (item.id === "__all__") { update("yearMin", null); update("yearMax", null); }
      else { update("yearMin", item.min ?? null); update("yearMax", item.max ?? null); }
    }
  };

  const openSub = (name) => {
    setSubPanel(name);
    // index 0 = back button, index 1 = first list item
    setTimeout(() => {
      const arr = mainRefs.current.filter(Boolean);
      const el = arr[1] ?? arr[0];
      if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest" }); }
    }, 40);
  };

  const closeSub = useCallback(() => {
    setSubPanel(null);
    setTimeout(() => {
      const arr = mainRefs.current.filter(Boolean);
      const el = arr[Math.max(0, Math.min(zoneIdx, arr.length - 1))];
      if (el) { el.focus({ preventScroll: true }); }
    }, 40);
  }, [zoneIdx]);

  // ── Keyboard capture ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const code = e.keyCode || e.which;
      e.preventDefault();
      e.stopImmediatePropagation();

      // BACK — close sub-panel or whole filter
      if (BACK_CODES.has(code)) {
        if (subPanel) closeSub();
        else closePanel();
        return;
      }

      // ── Sub-panel navigation ──────────────────────────────────────────────
      if (subPanel) {
        const arr = mainRefs.current.filter(Boolean);
        const ci  = arr.indexOf(document.activeElement);

        if (UP_CODES.has(code)) {
          if (ci > 0) {
            const el = arr[ci - 1];
            el.focus({ preventScroll: true });
            scrollToTop(el);
          }
          return;
        }
        if (DOWN_CODES.has(code)) {
          if (ci < arr.length - 1) {
            const el = arr[ci + 1];
            el.focus({ preventScroll: true });
            scrollToTop(el);
          }
          return;
        }
        if (LEFT_CODES.has(code))  { closeSub(); return; }
        if (ENTER_CODES.has(code) || RIGHT_CODES.has(code)) {
          document.activeElement?.click();
          return;
        }
        return;
      }

      // ── Main panel zones ──────────────────────────────────────────────────
      if (zone === "cats") {
        const arr = catRefs.current.filter(Boolean);
        if (LEFT_CODES.has(code))  { focusZone("cats", zoneIdx - 1); return; }
        if (RIGHT_CODES.has(code)) { focusZone("cats", zoneIdx + 1); return; }
        if (DOWN_CODES.has(code))  { focusZone("main", 0); return; }
        if (ENTER_CODES.has(code)) { arr[zoneIdx]?.click(); return; }
        return;
      }

      if (zone === "actions") {
        if (LEFT_CODES.has(code))  { focusZone("actions", zoneIdx - 1); return; }
        if (RIGHT_CODES.has(code)) { focusZone("actions", zoneIdx + 1); return; }
        if (UP_CODES.has(code)) {
          const arr = mainRefs.current.filter(Boolean);
          focusZone("main", arr.length - 1);
          return;
        }
        if (ENTER_CODES.has(code)) {
          actionRefs.current.filter(Boolean)[zoneIdx]?.click();
          return;
        }
        return;
      }

      // zone === "main"
      if (UP_CODES.has(code)) {
        if (zoneIdx > 0) focusZone("main", zoneIdx - 1);
        else focusZone("cats", 0);
        return;
      }
      if (DOWN_CODES.has(code)) {
        const arr = mainRefs.current.filter(Boolean);
        if (zoneIdx < arr.length - 1) focusZone("main", zoneIdx + 1);
        else focusZone("actions", 0);
        return;
      }
      if (RIGHT_CODES.has(code) || ENTER_CODES.has(code)) {
        const el = mainRefs.current.filter(Boolean)[zoneIdx];
        if (!el) return;
        const sub = el.dataset?.sub;
        if (sub) { openSub(sub); return; }
        el.click();
        return;
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [subPanel, zone, zoneIdx, closePanel, closeSub, focusZone]);

  // ── Sub-panel label ───────────────────────────────────────────────────────
  const subLabel = () => {
    if (subPanel === "genre")   return "Жанр";
    if (subPanel === "country") return "Країна";
    if (subPanel === "year")    return "Рік";
    if (subPanel === "rating")  return "Рейтинг";
    return "";
  };

  // main zone buttons: 4 filter rows + 3 sort options = 7
  const FILTER_ROWS = [
    { name: "genre",   label: "Жанр",    value: genreSummary()   },
    { name: "country", label: "Країна",  value: countrySummary() },
    { name: "year",    label: "Рік",     value: yearSummary()     },
    { name: "rating",  label: "Рейтинг", value: ratingSummary()   },
  ];

  return createPortal(
    <div className="fp-overlay" onClick={closePanel}>
      <div
        ref={panelRef}
        className={`fp-panel${sliding ? " fp-panel--open" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sub-panel ──────────────────────────────────────────── */}
        {subPanel && (
          <div className="fp-subpanel">
            <div className="fp-header">
              <button
                ref={el => (mainRefs.current[0] = el)}
                className="fp-back" onClick={closeSub}
              >
                <ChevronLeft size={22} />
              </button>
              <h2 className="fp-title">{subLabel()}</h2>
              <div style={{ width: 36 }} />
            </div>
            <div className="fp-sublist">
              {subItems().map((item, i) => (
                <button
                  key={item.id}
                  ref={el => (mainRefs.current[i + 1] = el)}
                  className={`fp-subrow${isSubItemActive(item) ? " fp-subrow--active" : ""}`}
                  onClick={() => toggleSub(item)}
                >
                  <span>{item.name ?? item.label}</span>
                  {isSubItemActive(item) && <Check size={16} className="fp-check" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Main panel ─────────────────────────────────────────── */}
        {!subPanel && (
          <>
            <div className="fp-header">
              <button className="fp-back" onClick={closePanel}><ChevronLeft size={22} /></button>
              <h2 className="fp-title">Фільтри</h2>
              <button className="fp-close-x" onClick={closePanel}><X size={18} /></button>
            </div>

            <div className="fp-body">
              {/* Category zone — LEFT/RIGHT only */}
              <div className="fp-cat-wrap">
                {CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.key}
                    ref={el => (catRefs.current[i] = el)}
                    type="button"
                    className={`fp-cat-btn${filters.mediaType === cat.key ? " fp-cat-btn--active" : ""}${zone === "cats" && zoneIdx === i ? " fp-cat-btn--focused" : ""}`}
                    onClick={() => update("mediaType", cat.key)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Filter rows — main zone [0..3] */}
              <div className="fp-section-label">Фільтри</div>
              <div className="fp-rows">
                {FILTER_ROWS.map(({ name, label, value }, i) => (
                  <button
                    key={name}
                    ref={el => (mainRefs.current[i] = el)}
                    className={`fp-row${zone === "main" && zoneIdx === i ? " fp-row--focused" : ""}`}
                    data-sub={name}
                    onClick={() => openSub(name)}
                  >
                    <span className="fp-row__label">{label}</span>
                    <span className="fp-row__value">{value} <ChevronRight size={15} /></span>
                  </button>
                ))}
              </div>

              {/* Sort — main zone [4..6] */}
              <div className="fp-section-label">Сортувати</div>
              <div className="fp-rows">
                {SORT_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.id}
                    ref={el => (mainRefs.current[FILTER_ROWS.length + i] = el)}
                    className={`fp-row fp-row--radio${filters.sortBy === opt.id ? " fp-row--radio-active" : ""}${zone === "main" && zoneIdx === FILTER_ROWS.length + i ? " fp-row--focused" : ""}`}
                    onClick={() => update("sortBy", opt.id)}
                  >
                    <span className="fp-row__label">{opt.label}</span>
                    <span className={`fp-radio${filters.sortBy === opt.id ? " fp-radio--active" : ""}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Actions zone — LEFT/RIGHT only */}
            <div className="fp-actions">
              <button
                ref={el => (actionRefs.current[0] = el)}
                className={`fp-btn fp-btn--reset${zone === "actions" && zoneIdx === 0 ? " fp-btn--focused" : ""}`}
                onClick={handleReset}
              >
                Скинути
              </button>
              <button
                ref={el => (actionRefs.current[1] = el)}
                className={`fp-btn fp-btn--apply${zone === "actions" && zoneIdx === 1 ? " fp-btn--focused" : ""}`}
                onClick={() => onApply(filters)}
              >
                Застосувати
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
