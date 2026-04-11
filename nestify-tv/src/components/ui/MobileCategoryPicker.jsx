import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

function norm(s = "") {
  return String(s).toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

export default function MobileCategoryPicker({
  open,
  onClose,
  title = "Категорії",
  featured = [],
  others = [],
  activeUrl = "",
  onSelect,
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const all = useMemo(() => [...featured, ...others], [featured, others]);

  const filtered = useMemo(() => {
    const query = norm(q);
    if (!query) return all;
    return all.filter((x) => norm(x?.title).includes(query));
  }, [all, q]);

  const activeTitle = useMemo(() => {
    const found = all.find((x) => x?.url === activeUrl);
    return found?.title || "";
  }, [all, activeUrl]);

  // lock body scroll + focus
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = setTimeout(() => inputRef.current?.focus(), 120);

    // ESC close
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  // scroll to active row when opened (nice)
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-url="${activeUrl}"]`);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ block: "center" });
      }, 180);
    }
  }, [open, activeUrl]);

  const pick = (url) => {
    onSelect?.(url);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
        >
          {/* backdrop */}
          <motion.button
            className="cp-backdrop"
            onClick={onClose}
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* sheet */}
          <motion.div
            className="cp-sheet"
            initial={{ y: 28, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 28, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* top */}
            <div className="cp-top">
              <button className="cp-close" onClick={onClose} aria-label="Close">
                ✕
              </button>

              <div className="cp-head">
                <div className="cp-kicker">{title}</div>
                <div className="cp-title">
                  {q ? (
                    <>
                      Результати: <span>{filtered.length}</span>
                    </>
                  ) : activeTitle ? (
                    <>
                      Активна: <span>{activeTitle}</span>
                    </>
                  ) : (
                    "Оберіть підкатегорію"
                  )}
                </div>
              </div>

              <div className="cp-right">
                {activeTitle && (
                  <div className="cp-pill">
                    <span className="cp-pillDot" />
                    {activeTitle}
                  </div>
                )}
              </div>
            </div>

            {/* search */}
            <div className="cp-searchWrap">
              <div className="cp-search">
                <span className="cp-searchIcon">⌕</span>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Пошук категорій…"
                />
                {q && (
                  <button className="cp-clear" onClick={() => setQ("")}>
                    Очистити
                  </button>
                )}
              </div>
            </div>

            {/* content */}
            <div className="cp-body" ref={listRef}>
              {!q && featured?.length > 0 && (
                <>
                  <div className="cp-section">Top</div>
                  <div className="cp-pills">
                    {featured.map((sub) => {
                      const active = sub.url === activeUrl;
                      return (
                        <button
                          key={sub.url}
                          className={`cp-pillBtn ${active ? "is-active" : ""}`}
                          onClick={() => pick(sub.url)}
                        >
                          {sub.title}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="cp-section">{q ? "Matches" : "All"}</div>

              <div className="cp-list">
                {filtered.map((sub) => {
                  const active = sub.url === activeUrl;
                  return (
                    <button
                      key={sub.url}
                      data-url={sub.url}
                      className={`cp-row ${active ? "is-active" : ""}`}
                      onClick={() => pick(sub.url)}
                    >
                      <div className="cp-rowTitle">{sub.title}</div>
                      <div className="cp-rowMeta">
                        {active ? "Selected" : ""}
                      </div>
                      <div className="cp-chevron">›</div>
                    </button>
                  );
                })}
              </div>

              <div className="cp-fadeBottom" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
