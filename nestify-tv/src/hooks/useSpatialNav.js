import { useEffect } from "react";
import { findNearest, focusFirst, recordFocus, scrollIntoFocus, scrollRowToTop } from "../utils/spatialNav";

/**
 * Map raw key codes → direction strings.
 * Covers: standard browsers, Samsung Orsay/Tizen, LG WebOS.
 */
function keyCodeToDir(code) {
  if (code === 37 || code === 4)     return "left";
  if (code === 39 || code === 5)     return "right";
  if (code === 38 || code === 29460) return "up";
  if (code === 40 || code === 29461) return "down";
  return null;
}

function isEnter(code) {
  return code === 13 || code === 29443 || code === 65385 || code === 117;
}

function isBack(code) {
  // 8=browser, 27=ESC, 461=LG, 10009=Samsung Tizen, 88=Samsung Orsay
  return code === 8 || code === 27 || code === 461 || code === 10009 || code === 88;
}

/**
 * Global D-pad / remote spatial navigation hook.
 * Mouse is fully disabled — only arrow keys and TV remote move focus.
 */
export function useSpatialNav() {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (document.body.classList.contains("torrent-modal-open") ||
          document.body.classList.contains("filter-panel-open")) {
        return;
      }

      const code = e.keyCode || e.which;

      // ── Back button → browser history back ──────────────────────────────
      if (isBack(code)) {
        e.preventDefault();
        window.history.back();
        return;
      }

      const dir = keyCodeToDir(code);

      if (!dir) {
        // Enter / OK — click the focused element
        if (isEnter(code)) {
          const el = document.activeElement;
          if (el && el !== document.body) {
            e.preventDefault();
            el.click();
          }
        }
        return;
      }

      e.preventDefault();

      const focused = document.activeElement;
      if (!focused || focused === document.body || focused === document.documentElement) {
        focusFirst();
        return;
      }

      let next = findNearest(focused, dir);

      if (!next) {
        if (dir === "right") {
          // Right edge → fall through to next row
          next = findNearest(focused, "down");
        } else if (dir === "left") {
          // Left edge → open sidebar (like Lampa)
          window.dispatchEvent(new CustomEvent("tv:open-sidebar"));
          return;
        } else if (dir === "down") {
          // Bottom boundary — scroll page down to reveal hidden content
          window.scrollBy({ top: window.innerHeight * 0.6, behavior: "smooth" });
          return;
        } else if (dir === "up") {
          // Top boundary — scroll page to top
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      if (next) {
        next.focus({ preventScroll: true });
        recordFocus(next); // update per-row memory (like Lampa's this.last)

        if (dir === "left" || dir === "right") {
          scrollIntoFocus(next);
        } else {
          scrollRowToTop(next);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
