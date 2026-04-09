// src/core/rezkaLink.js

// з "https://rezka.fi/series/drama/...html" -> "series/drama/..."
export function toRezkaSlug(raw) {
  if (!raw) return "";

  let url = raw.trim();

  // якщо повний URL — парсимо
  if (url.startsWith("http")) {
    try {
      const u = new URL(url);
      url = u.pathname; // "/series/drama/..."
    } catch {
      // ігноруємо, підемо далі з тим, що є
    }
  }

  // прибираємо початковий "/"
  if (url.startsWith("/")) url = url.slice(1);

  // прибираємо ".html" в кінці
  if (url.endsWith(".html")) url = url.slice(0, -5);

  return url;
}

// з "series/drama/..." -> "https://rezka.fi/series/drama/...html"
export function fromRezkaSlug(slug, baseUrl) {
  if (!slug) return null;
  let path = slug.trim();

  if (path.startsWith("/")) path = path.slice(1);
  if (!path.endsWith(".html")) path += ".html";

  // baseUrl типу "https://rezka.fi"
  let base = (baseUrl || "").replace(/\/+$/, "");
  if (!base) {
    // fallback, якщо забули вказати в config
    base = "https://rezka.ag";
  }

  return `${base}/${path}`;
}
