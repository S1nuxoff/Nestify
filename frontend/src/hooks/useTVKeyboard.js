// src/hooks/useTVKeyboard.js
//
// Spatial D-pad navigation for Android TV remote.
// Intercepts ArrowUp/Down/Left/Right globally and moves focus between
// all elements marked with .tv-focusable.
//
// Usage: call useTVKeyboard() once in App.js.
//
// Signals used (dataset on document.body):
//   tvPlayerActive  — PlayerPage is mounted; player handles its own keys
//   tvDialogOpen    — A modal dialog is open; Escape closes dialog, not history

import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const FOCUSABLE = '.tv-focusable';
const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function isVisible(el) {
  const r = el.getBoundingClientRect();
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.right > 0 &&
    r.top < window.innerHeight &&
    r.left < window.innerWidth
  );
}

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Spatial scoring: primary axis distance + 2× secondary axis penalty.
function score(from, to, key) {
  const a = center(from);
  const b = center(to);
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return (key === 'ArrowLeft' || key === 'ArrowRight')
    ? dx + dy * 2
    : dy + dx * 2;
}

function findTarget(key, active) {
  const src = center(active);
  const THRESH = 20;

  const candidates = Array.from(document.querySelectorAll(FOCUSABLE)).filter(
    (el) => {
      if (el === active || !isVisible(el)) return false;
      const pt = center(el);
      switch (key) {
        case 'ArrowRight': return pt.x > src.x + THRESH;
        case 'ArrowLeft':  return pt.x < src.x - THRESH;
        case 'ArrowDown':  return pt.y > src.y + THRESH;
        case 'ArrowUp':    return pt.y < src.y - THRESH;
        default: return false;
      }
    }
  );

  if (!candidates.length) return null;

  return candidates.reduce((best, el) =>
    score(active, el, key) < score(active, best, key) ? el : best
  );
}

function moveFocus(el) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function focusFirst() {
  const first = Array.from(document.querySelectorAll(FOCUSABLE)).find(isVisible);
  if (first) first.focus({ preventScroll: true });
}

export function useTVKeyboard() {
  const location = useLocation();

  // Auto-focus first visible focusable element when route changes.
  // Skips if: player is active, an input is focused, or a dialog is open.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (document.body.dataset.tvPlayerActive === 'true') return;
      if (document.body.dataset.tvDialogOpen === 'true') return;

      const active = document.activeElement;
      // Leave focus alone if it's already on a tv-focusable element
      if (active && active !== document.body && active.matches(FOCUSABLE)) return;
      // Leave focus alone if it's on a text input (e.g. SearchPage autoFocus)
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

      focusFirst();
    }, 600);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleKeyDown = useCallback((e) => {
    // PlayerPage handles all its own keys
    if (document.body.dataset.tvPlayerActive === 'true') return;

    // Escape / Back button
    if (e.key === 'Escape') {
      // If a dialog is open, let the dialog's own handler deal with it
      if (document.body.dataset.tvDialogOpen === 'true') return;

      const tag = document.activeElement?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        window.history.back();
      }
      return;
    }

    if (!ARROW_KEYS.includes(e.key)) return;

    // If focus is in a regular text input, only intercept ArrowDown
    // so the user can get from the search box to the result cards.
    const active = document.activeElement;
    const tag = active?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusFirst();
      }
      return;
    }

    const isFocusable = active?.matches?.(FOCUSABLE);

    if (!isFocusable) {
      e.preventDefault();
      focusFirst();
      return;
    }

    e.preventDefault();

    const target = findTarget(e.key, active);

    if (target) {
      moveFocus(target);
      return;
    }

    // No target for horizontal move → try to slide the parent Swiper
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const swiperEl = active.closest('.swiper');
      if (swiperEl?.swiper) {
        if (e.key === 'ArrowRight') swiperEl.swiper.slideNext(280);
        else swiperEl.swiper.slidePrev(280);

        setTimeout(() => {
          const next = findTarget(e.key, active);
          if (next) moveFocus(next);
        }, 330);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
