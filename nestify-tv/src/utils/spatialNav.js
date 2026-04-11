/**
 * Spatial navigation — Lampa-faithful implementation.
 *
 * Core model (same as Lampa):
 *
 *   • Each horizontal row remembers the last card focused inside it
 *     (rowFocusMemory WeakMap, keyed on the scroll container DOM element).
 *
 *   • LEFT / RIGHT  →  SpatialNavigator 9-zone math within the current row.
 *                       After moving, CENTER the card in the scroll container.
 *
 *   • UP / DOWN     →  Find the adjacent row via SpatialNavigator, then focus
 *                       that row's REMEMBERED card (or leftmost visible if none).
 *                       This ignores geometric proximity to the source card —
 *                       exactly what Lampa does.
 *
 *   • recordFocus() →  Called every time an element is focused; updates the
 *                       row memory so the next UP/DOWN can restore it.
 */

import { SpatialNavigator } from './SpatialNavigator';

// ── navigator instance ────────────────────────────────────────────────────
const nav = new SpatialNavigator();
nav.straightOnly = true;
nav.straightOverlapThreshold = 0.5;
nav.ignoreHiddenElement = true;
nav.silent = true;

// Relaxed navigator for UP/DOWN fallback (no strict straight-only requirement)
const navRelaxed = new SpatialNavigator();
navRelaxed.straightOnly = false;
navRelaxed.ignoreHiddenElement = true;
navRelaxed.silent = true;

// ── per-row focus memory (like Lampa's `this.last`) ───────────────────────
// Keys: scroll container DOM elements  Values: last focused card element
const rowMemory = new WeakMap();

/** Selector that marks a horizontal scroll container. */
const ROW_SELECTOR = '.cr-scroll, .cw-scroll, .tv-hscroll';

function getRow(el) {
  return el?.closest(ROW_SELECTOR) ?? null;
}

/**
 * Record that `el` is now the focused element inside its row.
 * Call this every time focus lands on a card.
 */
export function recordFocus(el) {
  const row = getRow(el);
  if (row) rowMemory.set(row, el);
}

// ── focusable element query ───────────────────────────────────────────────
const FOCUSABLE_SELECTOR =
  '[tabindex="0"], button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"])';

function getVisibleFocusables() {
  return [...document.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => {
    if (el.offsetParent === null) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

// ── core: find nearest ───────────────────────────────────────────────────
/**
 * Find the best next element from `from` in `direction`.
 *
 * LEFT / RIGHT  →  use SpatialNavigator directly (stays in-row naturally).
 * UP / DOWN     →  use SpatialNavigator to locate the target row, then
 *                  pick the row's remembered card (or leftmost visible).
 */
export function findNearest(from, direction) {
  const all = getVisibleFocusables();
  nav.setCollection(all);
  nav.focused(from);

  let candidate = nav.navigate(from, direction);

  // ── UP / DOWN: if strict navigator finds nothing, try relaxed ────────
  if (!candidate && (direction === 'up' || direction === 'down')) {
    navRelaxed.setCollection(all);
    navRelaxed.focused(from);
    candidate = navRelaxed.navigate(from, direction);
  }

  if (!candidate) return null;

  // ── LEFT / RIGHT: return SpatialNavigator result directly ────────────
  if (direction === 'left' || direction === 'right') {
    return candidate;
  }

  // ── UP / DOWN: restore row memory ────────────────────────────────────
  const targetRow = getRow(candidate);

  if (targetRow) {
    // 1. Try remembered card
    const remembered = rowMemory.get(targetRow);
    if (remembered && targetRow.contains(remembered) && remembered.offsetParent !== null) {
      const rr = remembered.getBoundingClientRect();
      if (rr.width > 0 && rr.height > 0) return remembered;
    }

    // 2. Leftmost viewport-visible card in target row
    const vw = window.innerWidth;
    const inRow = all.filter(
      (el) => el !== from && targetRow.contains(el)
    );
    const visible = inRow.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.left < vw - 16;
    });
    const pool = visible.length ? visible : inRow;
    if (pool.length) {
      pool.sort(
        (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left
      );
      return pool[0];
    }
  }

  // candidate not in a row (e.g. featured hero, category pill) — use as-is
  return candidate;
}

// ── scroll helpers ────────────────────────────────────────────────────────

/**
 * Center the focused card inside its horizontal scroll container.
 * Equivalent to Lampa's scroll.update(el, tocenter=true).
 * Then scroll the PAGE so the row is near the top.
 */
export function scrollIntoFocus(el) {
  const hScroll = el.closest(ROW_SELECTOR);
  if (hScroll) {
    const elRect        = el.getBoundingClientRect();
    const containerRect = hScroll.getBoundingClientRect();
    // How far the card's center is from the container's center
    const elMid        = elRect.left + elRect.width / 2;
    const containerMid = containerRect.left + hScroll.clientWidth / 2;
    const delta        = elMid - containerMid;
    const newLeft      = Math.max(0, hScroll.scrollLeft + delta);
    hScroll.scrollTo({ left: newLeft, behavior: 'smooth' });
  }
  scrollRowToTop(el);
}

/**
 * Scroll only the PAGE so the row containing `el` appears near the top.
 * Does NOT touch the row's horizontal scroll.
 * Used after UP / DOWN navigation.
 */
export function scrollRowToTop(el) {
  // Featured hero, movie page hero, or search top bar → scroll to very top
  if (el.closest('.ft-root') || el.closest('.mh-hero') || el.closest('.sp-sticky') || el.closest('.sp-searchbar')) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Find the nearest section/row container to align at the top
  const row = el.closest([
    '.cr-container',           // ContentRow wrapper (home + movie recommendations)
    '.continue-watching-row',  // Continue-watching row
    '.home-category-selector', // Category pills (home)
    '.movie-cast',             // Cast section (movie page)
    '.movie-page__details > section', // Trailers / Episodes / Reviews (movie page)
    '.sp-section',             // Search page genre slider / sections
  ].join(', '));

  if (row) {
    const TOP_OFFSET = 52;
    const top = row.getBoundingClientRect().top + window.scrollY - TOP_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

/**
 * Focus the first visible focusable element on the page.
 */
export function focusFirst() {
  const el = getVisibleFocusables()[0];
  if (el) {
    el.focus({ preventScroll: false });
    recordFocus(el);
  }
}
