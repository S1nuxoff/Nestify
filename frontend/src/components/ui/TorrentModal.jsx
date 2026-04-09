import React, { useState, useEffect, useRef, useCallback } from "react";
import { searchTorrents, addTorrent, getTorrentStatus } from "../../api/v3";
import { X, Search, Play, Tv, Wifi } from "lucide-react";

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return "0 KB/s";
  const mb = bytesPerSec / 1024 / 1024;
  if (mb >= 1) return mb.toFixed(1) + " MB/s";
  return (bytesPerSec / 1024).toFixed(0) + " KB/s";
}

function formatSize(bytes) {
  if (!bytes) return "?";
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return gb.toFixed(2) + " GB";
  const mb = bytes / 1024 / 1024;
  return mb.toFixed(0) + " MB";
}

function parseTorrentMeta(title) {
  const t = title.toUpperCase();

  // Quality
  let quality = null;
  if (t.includes("2160P") || t.includes("4K") || t.includes("UHD")) quality = "4K";
  else if (t.includes("1080P")) quality = "1080p";
  else if (t.includes("720P")) quality = "720p";
  else if (t.includes("480P")) quality = "480p";

  // Source
  let source = null;
  if (t.includes("BDREMUX") || t.includes("BLU-RAY REMUX") || t.includes("BLURAY REMUX")) source = "BDRemux";
  else if (t.includes("BLURAY") || t.includes("BLU-RAY") || t.includes("BLU RAY")) source = "BluRay";
  else if (t.includes("BDRIP")) source = "BDRip";
  else if (t.includes("WEB-DL") || t.includes("WEBDL")) source = "WEB-DL";
  else if (t.includes("WEBRIP") || t.includes("WEB RIP")) source = "WEBRip";
  else if (t.includes("HDRIP")) source = "HDRip";
  else if (t.includes("DVDRIP")) source = "DVDRip";

  // HDR
  let hdr = null;
  if (t.includes("DOLBY VISION") || t.includes("DOLBY.VISION")) hdr = "DV";
  else if (t.includes("HDR")) hdr = "HDR";

  // Languages
  const langs = [];
  if (t.includes("UKR")) langs.push("Укр");
  if (t.includes("ENG")) langs.push("Eng");
  if (t.includes("LEKTOR PL") || t.includes("[PL") || (t.includes(" PL]"))) langs.push("PL");
  if (
    t.includes("RUSSIAN") || t.includes("RUS") ||
    / [|,] ?D[,| \]]/.test(t) || t.endsWith("| D") ||
    t.includes("DUB")
  ) langs.push("Рус");
  if (t.includes("AVO") || t.includes("DVO")) langs.push("VO");

  // Subs
  const subs = [];
  if (t.includes("SUB UKR") || t.includes("SUB. UKR")) subs.push("Sub Укр");
  if (t.includes("SUB ENG") || t.includes("SUB. ENG")) subs.push("Sub Eng");
  if (t.includes("SUB RUS") || t.includes("SUB. RUS")) subs.push("Sub Рус");

  return { quality, source, hdr, langs: [...new Set(langs)], subs };
}

export default function TorrentModal({ title, titleOriginal, year, imdbId, tmdbId, mediaType, onClose, onSendToTv, onPlayInBrowser }) {
  const [query, setQuery] = useState(`${titleOriginal || title}${year ? " " + year : ""}`);
  const [results, setResults] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentHash, setCurrentHash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [addingHash, setAddingHash] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("search"); // "search" | "files" | "preload"
  const [preloadInfo, setPreloadInfo] = useState(null); // { speed, peers, stat_string }
  const [pendingAction, setPendingAction] = useState(null); // { type: "browser"|"tv", file }
  const pollRef = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) return;
    setError(null);
    setLoading(true);
    setResults([]);
    try {
      const data = await searchTorrents({
        q: q.trim(),
        title: title,
        title_original: titleOriginal || title,
        year: year ? parseInt(year) : undefined,
        imdb_id: imdbId,
        tmdb_id: tmdbId,
        media_type: mediaType || "movie",
      });
      setResults(data);
      if (data.length === 0) setError("Нічого не знайдено");
    } catch {
      setError("Помилка пошуку. Перевір підключення до Jackett.");
    } finally {
      setLoading(false);
    }
  };

  // Авто-пошук при відкритті
  useEffect(() => {
    doSearch(query);
  }, []);

  const handleSearch = (e) => {
    e?.preventDefault();
    doSearch(query);
  };

  const handleSelectTorrent = async (torrent) => {
    setError(null);
    setAddingHash(torrent.magnet);
    setLoading(true);
    try {
      const data = await addTorrent(torrent.magnet, torrent.title);
      setCurrentHash(data.hash);
      setFiles(data.files);
      setStep("files");
    } catch {
      setError("Не вдалось додати торент. TorrServe недоступний.");
    } finally {
      setLoading(false);
      setAddingHash(null);
    }
  };

  const startPreload = (type, file) => {
    setPendingAction({ type, file });
    setPreloadInfo({ speed: 0, peers: 0, stat_string: "Підключення...", elapsed: 0 });
    setStep("preload");

    // Тригеримо буферизацію — робимо HEAD запит до stream_url щоб TorrServe почав качати
    fetch(file.stream_url, { method: "GET", signal: AbortSignal.timeout(3000) }).catch(() => {});

    let elapsed = 0;
    // Перший poll через 2 секунди — TorrServe потребує часу на підключення до пірів
    setTimeout(() => {
      pollRef.current = setInterval(async () => {
        elapsed += 1;
        try {
          const status = await getTorrentStatus(currentHash);
          const speed = status.download_speed || 0;
          const peers = status.peers_connected || 0;
          const stat_string = status.stat_string || "";
          setPreloadInfo({ speed, peers, stat_string, elapsed });

          // Готово: є швидкість і пройшло мінімум 3 секунди, або 12 секунд загалом
          const ready = (speed > 50_000 && elapsed >= 3) || elapsed >= 12;
          if (ready) {
            clearInterval(pollRef.current);
            executeAction(type, file);
          }
        } catch {
          if (elapsed >= 8) {
            clearInterval(pollRef.current);
            executeAction(type, file);
          }
        }
      }, 1000);
    }, 2000);
  };

  const executeAction = (type, file) => {
    if (type === "browser") {
      if (onPlayInBrowser) onPlayInBrowser(file);
      else window.open(file.stream_url, "_blank");
    } else {
      if (onSendToTv) onSendToTv({ ...file, hash: currentHash });
    }
    onClose();
  };

  // Чистимо poll при закритті
  useEffect(() => () => clearInterval(pollRef.current), []);

  const handlePlayInBrowser = (file) => startPreload("browser", file);
  const handleSendToTv = (file) => startPreload("tv", file);

  return (
    <div className="torrent-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="torrent-modal">
        {/* Header */}
        <div className="torrent-modal__header">
          <h2 className="torrent-modal__title">
            {step === "search" ? "Пошук роздачі" : "Оберіть файл"}
          </h2>
          <button className="torrent-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Search step */}
        {step === "search" && (
          <>
            <form className="torrent-modal__search" onSubmit={handleSearch}>
              <input
                className="torrent-modal__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Назва фільму..."
              />
              <button className="torrent-modal__search-btn" type="submit" disabled={loading}>
                <Search size={18} />
              </button>
            </form>

            {loading && (
              <div className="torrent-modal__loading">
                <div className="spinner" />
                <span>{addingHash ? "Додаємо торент…" : "Шукаємо…"}</span>
              </div>
            )}

            {error && <div className="torrent-modal__error">{error}</div>}

            {!loading && results.length > 0 && (
              <ul className="torrent-modal__list">
                {results.map((t, i) => {
                  const meta = parseTorrentMeta(t.title);
                  return (
                    <li key={i} className={`torrent-modal__item${t.seeders === 0 ? " torrent-modal__item--dead" : ""}`} onClick={() => handleSelectTorrent(t)}>
                      <div className="torrent-modal__item-title">{t.title}</div>
                      <div className="torrent-modal__item-meta">
                        {meta.quality && (
                          <span className="torrent-modal__badge torrent-modal__badge--quality">
                            {meta.quality}
                          </span>
                        )}
                        {meta.source && (
                          <span className="torrent-modal__badge torrent-modal__badge--source">
                            {meta.source}
                          </span>
                        )}
                        {meta.hdr && (
                          <span className="torrent-modal__badge torrent-modal__badge--hdr">
                            {meta.hdr}
                          </span>
                        )}
                        {meta.langs.map(l => (
                          <span key={l} className="torrent-modal__badge torrent-modal__badge--lang">
                            {l}
                          </span>
                        ))}
                        {meta.subs.map(s => (
                          <span key={s} className="torrent-modal__badge torrent-modal__badge--sub">
                            {s}
                          </span>
                        ))}
                        <span className="torrent-modal__badge torrent-modal__badge--green">
                          ▲ {t.seeders}
                        </span>
                        <span className="torrent-modal__badge">
                          {formatSize(t.size)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* Preload step */}
        {step === "preload" && preloadInfo && (
          <div className="torrent-modal__preload">
            <div className="torrent-modal__preload-spinner">
              <div className="spinner" />
            </div>
            <div className="torrent-modal__preload-title">Підготовка до перегляду...</div>
            <div className="torrent-modal__preload-stats">
              <div className="torrent-modal__preload-stat">
                <Wifi size={16} />
                <span>{formatSpeed(preloadInfo.speed)}</span>
              </div>
              <div className="torrent-modal__preload-stat">
                <span>👥 {preloadInfo.peers} пірів</span>
              </div>
            </div>
            {(preloadInfo.elapsed || 0) >= 5 && preloadInfo.speed === 0 && (
              <div className="torrent-modal__error">⚠️ Немає сідів — спробуй інший торент</div>
            )}
            {preloadInfo.stat_string && preloadInfo.speed > 0 && (
              <div className="torrent-modal__preload-status">{preloadInfo.stat_string}</div>
            )}
            <div className="torrent-modal__preload-bar">
              <div
                className="torrent-modal__preload-bar-fill"
                style={{ width: `${Math.min((preloadInfo.elapsed || 0) * 10, 100)}%` }}
              />
            </div>
            <button
              className="torrent-modal__preload-skip"
              onClick={() => { clearInterval(pollRef.current); executeAction(pendingAction.type, pendingAction.file); }}
            >
              Пропустити →
            </button>
          </div>
        )}

        {/* Files step */}
        {step === "files" && (
          <>
            <button
              className="torrent-modal__back"
              onClick={() => { setStep("search"); setFiles([]); setCurrentHash(null); }}
            >
              ← Назад
            </button>

            {files.length === 0 && (
              <div className="torrent-modal__error">Відео-файли не знайдено</div>
            )}

            <ul className="torrent-modal__list">
              {files.map((f, i) => (
                <li key={i} className="torrent-modal__item torrent-modal__item--file">
                  <div className="torrent-modal__item-title">{f.name}</div>
                  <div className="torrent-modal__item-meta">
                    <span className="torrent-modal__badge">{formatSize(f.size)}</span>
                  </div>
                  <div className="torrent-modal__file-actions">
                    <button
                      className="torrent-modal__action-btn"
                      onClick={() => handlePlayInBrowser(f)}
                      title="Відкрити в браузері"
                    >
                      <Play size={16} />
                      <span>В браузері</span>
                    </button>
                    {onSendToTv && (
                      <button
                        className="torrent-modal__action-btn torrent-modal__action-btn--tv"
                        onClick={() => handleSendToTv(f)}
                        title="Надіслати на TV"
                      >
                        <Tv size={16} />
                        <span>На TV</span>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
