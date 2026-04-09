import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { searchTorrents, addTorrent, getTorrentStatus, removeTorrent, preloadTorrent, getFileInfo, startHlsSession } from "../../api/v3";
import { X, Play, Tv, Loader2, Zap, ChevronRight } from "lucide-react";
import { getCurrentProfile } from "../../core/session";
import { getCachedTorrents, setCachedTorrents, makeTorrentCacheKey } from "../../core/torrentCache";

/* ─── helpers ──────────────────────────────────────────────── */
function formatSize(b) {
  if (!b) return "?";
  const gb = b / 1024 / 1024 / 1024;
  return gb >= 1 ? gb.toFixed(2) + " GB" : (b / 1024 / 1024).toFixed(0) + " MB";
}

function formatDate(pub_date) {
  if (!pub_date) return null;
  try {
    const d = new Date(pub_date);
    if (isNaN(d)) return null;
    return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return null; }
}

function calcBitrate(sizeBytes, runtimeMinutes) {
  if (!sizeBytes || !runtimeMinutes) return null;
  const kbps = Math.round((sizeBytes * 8) / (runtimeMinutes * 60) / 1000);
  if (kbps <= 0) return null;
  return kbps >= 1000 ? (kbps / 1000).toFixed(1) + " Mbps" : kbps + " kbps";
}

function parseMeta(title, jacredQuality = null, videotype = "") {
  const t = title.toUpperCase();

  // Quality: беремо з JacRed якщо є, інакше парсимо з назви
  let quality = jacredQuality || null;
  if (!quality) {
    if (t.includes("2160P") || t.includes("4K") || t.includes("UHD")) quality = "4K";
    else if (t.includes("1080P")) quality = "1080p";
    else if (t.includes("720P")) quality = "720p";
    else if (t.includes("480P")) quality = "480p";
  }

  let source = null;
  if (t.includes("BDREMUX") || t.includes("BLU-RAY REMUX") || t.includes("BLURAY REMUX")) source = "BDRemux";
  else if (t.includes("BLURAY") || t.includes("BLU-RAY") || t.includes("BLU RAY")) source = "BluRay";
  else if (t.includes("BDRIP")) source = "BDRip";
  else if (t.includes("WEB-DL") || t.includes("WEBDL")) source = "WEB-DL";
  else if (t.includes("WEBRIP") || t.includes("WEB RIP")) source = "WEBRip";
  else if (t.includes("HDRIP")) source = "HDRip";
  else if (t.includes("DVDRIP")) source = "DVDRip";

  // HDR з videotype або з назви
  let hdr = null;
  const vt = (videotype || "").toLowerCase();
  if (vt.includes("dolby") || vt === "dv") hdr = "DV";
  else if (vt.includes("hdr")) hdr = "HDR";
  else if (t.includes("DOLBY VISION") || t.includes("DOLBY.VISION")) hdr = "DV";
  else if (t.includes("HDR")) hdr = "HDR";

  return { quality, source, hdr };
}

// Парсить S##E## з назви файлу
function parseEpisode(name) {
  const m = name.match(/S(\d+)E(\d+)/i);
  if (!m) return null;
  return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
}

// Групує файли по сезонах, повертає Map { season -> [file...] }
function groupBySeason(files) {
  const map = new Map();
  for (const f of files) {
    const ep = parseEpisode(f.name);
    if (!ep) continue;
    const s = ep.season;
    if (!map.has(s)) map.set(s, []);
    map.get(s).push({ ...f, season: ep.season, episode: ep.episode });
  }
  // sort episodes within each season
  for (const [s, eps] of map) {
    map.set(s, eps.sort((a, b) => a.episode - b.episode));
  }
  return map;
}

const QUALITY_COLOR = { "4K": "#f59e0b", "1080p": "#60a5fa", "720p": "#34d399", "480p": "#9ca3af" };

/* ─── helpers ── */
function extractBtih(magnet) {
  if (!magnet) return null;
  const m = magnet.match(/xt=urn:btih:([a-f0-9]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/* ─── component ─────────────────────────────────────────────── */
export default function TorrentModal({
  title, titleOriginal, titleEnglish = null, titlePolish = null, year, imdbId, tmdbId, mediaType, poster, runtimeMinutes,
  watchedMagnet = null,
  onClose, onSendToTv, onPlayInBrowser,
}) {
  const watchedBtih = extractBtih(watchedMagnet);
  const [results, setResults]         = useState({ uk: [], ru: [], en: [], pl: [] });
  const [files, setFiles]             = useState([]);
  const [currentHash, setCurrentHash] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [addingIdx, setAddingIdx]     = useState(null);
  const [error, setError]             = useState(null);
  const [step, setStep]               = useState("search"); // search | files | preload
  const [preloadInfo, setPreloadInfo] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [langTab, setLangTab]         = useState(() => getCurrentProfile()?.default_lang || "best");
  const [qualityFilter, setQualityFilter] = useState(null);
  const [focusedIdx, setFocusedIdx]   = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);

  const pollRef          = useRef(null);
  const playingRef       = useRef(false);
  const listRef          = useRef(null);
  const itemRefs         = useRef([]);
  const selectedMagnetRef = useRef(null);

  /* ── hide mini player while modal is open ── */
  useEffect(() => {
    document.body.classList.add("torrent-modal-open");
    return () => document.body.classList.remove("torrent-modal-open");
  }, []);

  /* ── season grouping ── */
  const seasonMap = useMemo(() => groupBySeason(files), [files]);
  const isSeries  = seasonMap.size > 0;
  const seasons   = useMemo(() => [...seasonMap.keys()].sort((a, b) => a - b), [seasonMap]);

  // Автоматично вибираємо перший сезон
  useEffect(() => {
    if (isSeries && seasons.length > 0 && selectedSeason === null) {
      setSelectedSeason(seasons[0]);
    }
  }, [isSeries, seasons, selectedSeason]);

  const episodesInSeason = selectedSeason !== null ? (seasonMap.get(selectedSeason) || []) : [];

  /* ── search ── */
  const doSearch = useCallback(async () => {
    const cacheKey = makeTorrentCacheKey({ tmdbId, mediaType, title: title || titleOriginal });
    const cached = getCachedTorrents(cacheKey);
    if (cached) {
      setResults(cached);
      setFocusedIdx(0);
      const total = cached.uk.length + cached.ru.length + cached.en.length + cached.pl.length;
      if (!total) setError("Нічого не знайдено");
      return;
    }

    setError(null); setLoading(true); setResults({ uk: [], ru: [], en: [], pl: [] }); setFocusedIdx(0);
    try {
      const data = await searchTorrents({
        q: title || titleOriginal || "",
        title,
        title_original: titleOriginal || title,
        title_en: titleEnglish || undefined,
        title_pl: titlePolish || undefined,
        year: year ? parseInt(year) : undefined,
        imdb_id: imdbId, tmdb_id: tmdbId, media_type: mediaType || "movie",
      });
      const grouped = { uk: data.uk || [], ru: data.ru || [], en: data.en || [], pl: data.pl || [] };
      setCachedTorrents(cacheKey, grouped);
      setResults(grouped);
      const total = grouped.uk.length + grouped.ru.length + grouped.en.length;
      if (!total) setError("Нічого не знайдено");
    } catch { setError("Помилка пошуку."); }
    finally { setLoading(false); }
  }, [title, titleOriginal, titleEnglish, year, imdbId, tmdbId, mediaType]);

  useEffect(() => { doSearch(); }, []);

  /* ── select torrent ── */
  const handleSelectTorrent = useCallback(async (torrent, idx) => {
    setError(null); setAddingIdx(idx); setLoading(true);
    selectedMagnetRef.current = torrent.magnet;
    try {
      const torrTitle = `[Nestify] ${title || titleOriginal || torrent.title}`;
      const data = await addTorrent(torrent.magnet, torrTitle, poster || "");
      setCurrentHash(data.hash);
      setFiles(data.files);
      setSelectedSeason(null);
      setStep("files");
      setFocusedIdx(0);
    } catch { setError("Не вдалось додати торент."); }
    finally { setLoading(false); setAddingIdx(null); }
  }, [title, titleOriginal, poster]);

  /* ── preload ── */
  const startPreload = useCallback((type, file) => {
    setPendingAction({ type, file });
    setPreloadInfo({ peers: 0, stat: 0, stat_string: "Підключення...", elapsed: 0 });
    setStep("preload");

    const hash = currentHash;
    preloadTorrent(hash, file.file_id).catch(() => {});

    // Паралельно: ffprobe для тривалості + HLS сесія (тільки для браузера)
    let fileDurationSeconds = null;
    let hlsSessionId = null;
    let hlsPlaylistUrl = null;

    getFileInfo(hash, file.file_id).then(info => {
      const d = info?.format?.duration;
      if (d) fileDurationSeconds = parseFloat(d);
    }).catch(() => {});

    if (type === "browser") {
      // Передаємо тривалість одразу — щоб бекенд згенерував статичний VOD m3u8
      const knownDuration = runtimeMinutes ? runtimeMinutes * 60 : 0;
      startHlsSession(hash, file.file_id, file.name, 0, knownDuration).then(data => {
        hlsSessionId = data.session_id;
        hlsPlaylistUrl = data.playlist_url;
      }).catch(() => {});
    }

    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 1;
      try {
        const s = await getTorrentStatus(hash);
        const stat = s.stat || 0;
        setPreloadInfo({ peers: s.peers_connected || 0, stat, stat_string: s.stat_string || "", elapsed });
        if (stat >= 3 || elapsed >= 12) {
          clearInterval(pollRef.current);
          executeAction(type, file, fileDurationSeconds, hlsSessionId, hlsPlaylistUrl);
        }
      } catch {
        if (elapsed >= 10) {
          clearInterval(pollRef.current);
          executeAction(type, file, fileDurationSeconds, hlsSessionId, hlsPlaylistUrl);
        }
      }
    }, 1000);
  }, [currentHash]);

  const executeAction = useCallback((type, file, durationSeconds = null, hlsSessionId = null, hlsPlaylistUrl = null) => {
    playingRef.current = true;
    if (type === "browser") {
      const hlsInfo = { sessionId: hlsSessionId, hash: currentHash, fileId: file.file_id, fname: file.name, magnet: selectedMagnetRef.current };
      if (onPlayInBrowser) onPlayInBrowser(file, durationSeconds, hlsInfo, hlsPlaylistUrl);
      else window.open(file.stream_url, "_blank");
    } else {
      // TV: пряма проксі без FFmpeg
      const tvFile = { ...file, stream_url: file.stream_url_direct || file.stream_url, hash: currentHash };
      if (onSendToTv) onSendToTv(tvFile);
    }
    onClose();
  }, [onPlayInBrowser, onSendToTv, onClose, currentHash]);

  useEffect(() => () => {
    clearInterval(pollRef.current);
    if (currentHash && !playingRef.current) removeTorrent(currentHash).catch(() => {});
  }, [currentHash]);

  /* ── tab results ── */
  const availableQualities = useMemo(() => {
    const base = langTab === "best"
      ? [...(results.uk || []), ...(results.ru || []), ...(results.en || []), ...(results.pl || [])]
      : (results[langTab] || []);
    const qs = new Set(base.map(t => parseMeta(t.title, t.quality, t.videotype).quality).filter(Boolean));
    return ["4K", "1080p", "720p", "480p"].filter(q => qs.has(q));
  }, [results, langTab]);

  const tabResults = useMemo(() => {
    let items;
    if (langTab === "best") {
      const all = [...(results.uk || []), ...(results.ru || []), ...(results.en || []), ...(results.pl || [])];
      const seen = new Set();
      const deduped = all.filter(r => { if (seen.has(r.magnet)) return false; seen.add(r.magnet); return true; });
      items = [...deduped].sort((a, b) => (b.seeders || 0) - (a.seeders || 0)).slice(0, 30);
    } else {
      items = [...(results[langTab] || [])].sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
    }
    if (qualityFilter) {
      items = items.filter(t => parseMeta(t.title, t.quality, t.videotype).quality === qualityFilter);
    }
    return items;
  }, [results, langTab, qualityFilter]);

  const activeList = step === "files" ? (isSeries ? episodesInSeason : files) : tabResults;

  /* ── keyboard navigation ── */
  useEffect(() => {
    const onKey = (e) => {
      if (step === "preload") return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIdx(i => Math.min(i + 1, activeList.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIdx(i => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (step === "search" && tabResults[focusedIdx]) handleSelectTorrent(tabResults[focusedIdx], focusedIdx);
          if (step === "files") {
            const f = isSeries ? episodesInSeason[focusedIdx] : files[focusedIdx];
            if (f) startPreload("browser", f);
          }
          break;
        case "Backspace":
        case "Escape":
          e.preventDefault();
          if (step === "files") { setStep("search"); setFiles([]); setCurrentHash(null); setFocusedIdx(0); }
          else onClose();
          break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, focusedIdx, tabResults, files, activeList, isSeries, episodesInSeason, handleSelectTorrent, startPreload, onClose]);

  useEffect(() => {
    const el = itemRefs.current[focusedIdx];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIdx]);

  /* ── lock body scroll ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── animation ── */
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 280); };

  return (
    <div className={`tv-overlay${visible ? " tv-overlay--in" : ""}`} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className={`tv-panel${visible ? " tv-panel--in" : ""}`}>

        {/* ── Handle ── */}
        <div className="tv-handle" />

        {/* ── Top bar ── */}
        <div className="tv-topbar">
          <div />
          <div className="tv-topbar__info">
            <span className="tv-topbar__movie">{title || titleOriginal}</span>
            {year && <span className="tv-topbar__year">{year}</span>}
          </div>
          <button className="tv-close" onClick={handleClose} aria-label="Закрити"><X size={14} /></button>
        </div>

        {/* ── Search step ── */}
        {step === "search" && (
          <>
            {/* ── Мовні таби ── */}
            {!loading && (
              <div className="tv-langs">
                {[
                  { key: "best", icon: null, text: "Кращі", count: (results.uk.length + results.ru.length + results.en.length + results.pl.length) },
                  { key: "uk",   label: null,  icon: "/images/ua.svg", text: "Укр", count: results.uk.length },
                  { key: "ru",   label: null,  icon: "/images/ru.svg", text: "Рус", count: results.ru.length },
                  { key: "en",   label: null,  icon: "/images/us.svg", text: "Eng", count: results.en.length },
                  { key: "pl",   label: null,  icon: "/images/pl.svg", text: "Pol", count: results.pl.length },
                ].map(({ key, icon, emoji, text, count }) => count > 0 && (
                  <button
                    key={key}
                    className={`tv-lang${langTab === key ? " tv-lang--on" : ""}`}
                    onClick={() => { setLangTab(key); setFocusedIdx(0); setQualityFilter(null); setSelectedIdx(null); }}
                  >
                    {icon
                      ? <img src={icon} alt={text} className="tv-lang__flag" />
                      : <Zap size={13} />
                    }
                    {text}<span className="tv-lang__n">{key === "best" ? "30" : count}</span>
                  </button>
                ))}
              </div>
            )}

            {!loading && availableQualities.length > 1 && (
              <div className="tv-qfilter">
                <button
                  className={`tv-qf-btn${qualityFilter === null ? " tv-qf-btn--on" : ""}`}
                  onClick={() => { setQualityFilter(null); setFocusedIdx(0); }}
                >Всі</button>
                {availableQualities.map(q => (
                  <button
                    key={q}
                    className={`tv-qf-btn${qualityFilter === q ? " tv-qf-btn--on" : ""}`}
                    style={qualityFilter === q ? { color: QUALITY_COLOR[q], borderColor: QUALITY_COLOR[q] } : {}}
                    onClick={() => { setQualityFilter(q === qualityFilter ? null : q); setFocusedIdx(0); setSelectedIdx(null); }}
                  >{q}</button>
                ))}
              </div>
            )}

            {loading && (
              <div className="tv-status">
                <Loader2 size={18} className="tv-spin" />
                <span>{addingIdx !== null ? "Додаємо торент…" : "Шукаємо…"}</span>
              </div>
            )}
            {error && <div className="tv-error">{error}</div>}

            {!loading && tabResults.length > 0 && (
              <ul className="tv-list" ref={listRef}>
                {tabResults.map((t, i) => {
                  const meta = parseMeta(t.title, t.quality, t.videotype);
                  const focused = focusedIdx === i;
                  const isWatched = watchedBtih && extractBtih(t.magnet) === watchedBtih;
                  return (
                    <li
                      key={i}
                      ref={el => itemRefs.current[i] = el}
                      className={`tv-item${focused ? " tv-item--focused" : ""}${t.seeders === 0 ? " tv-item--dead" : ""}${addingIdx === i ? " tv-item--loading" : ""}${isWatched ? " tv-item--watched" : ""}${selectedIdx === i ? " tv-item--selected" : ""}`}
                      onClick={() => { setSelectedIdx(i); setFocusedIdx(i); }}
                      onMouseEnter={() => setFocusedIdx(i)}
                    >
                      <div className="tv-item__body">
                        <div className="tv-item__title">{t.title}</div>
                        <div className="tv-item__row">
                          {(t.voices || []).slice(0, 2).map(v => (
                            <span key={v} className="tv-pill tv-pill--voice">{v}</span>
                          ))}
                          {meta.source && <span className="tv-pill tv-pill--src">{meta.source}</span>}
                          {meta.hdr && <span className="tv-pill tv-pill--hdr">{meta.hdr}</span>}
                        </div>
                        <div className="tv-item__stats">
                          <span className="tv-stat tv-stat--seeds">▲ {t.seeders}</span>
                          {calcBitrate(t.size, runtimeMinutes) && <span className="tv-stat">{calcBitrate(t.size, runtimeMinutes)}</span>}
                        </div>
                      </div>
                      <div className="tv-item__right">
                        {isWatched && <span className="tv-watched-badge">▶</span>}
                        <span className="tv-item__size">{formatSize(t.size)}</span>
                        {addingIdx === i
                          ? <Loader2 size={18} className="tv-spin" />
                          : <div className={`tv-radio${selectedIdx === i ? " tv-radio--on" : ""}`} />
                        }
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {!loading && tabResults.length > 0 && (
              <div className="tv-action-bar">
                <button
                  className={`tv-action-btn${selectedIdx === null ? " tv-action-btn--disabled" : ""}`}
                  disabled={selectedIdx === null}
                  onClick={() => selectedIdx !== null && handleSelectTorrent(tabResults[selectedIdx], selectedIdx)}
                >
                  Дивитись
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Files step ── */}
        {step === "files" && (
          <>
            <button className="tv-back" onClick={() => { setStep("search"); setFiles([]); setCurrentHash(null); setFocusedIdx(0); setSelectedIdx(null); setSelectedSeason(null); }}>
              ← Назад до результатів
            </button>

            {files.length === 0 && <div className="tv-error">Відео-файли не знайдено</div>}

            {/* Серіал: таби сезонів + сітка епізодів */}
            {isSeries ? (
              <>
                {seasons.length > 1 && (
                  <div className="tv-seasons">
                    {seasons.map(s => (
                      <button
                        key={s}
                        className={`tv-season-tab${selectedSeason === s ? " tv-season-tab--on" : ""}`}
                        onClick={() => { setSelectedSeason(s); setFocusedIdx(0); }}
                      >
                        Сезон {s}
                        <span className="tv-lang__n">{seasonMap.get(s).length}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="tv-episodes" ref={listRef}>
                  {episodesInSeason.map((f, i) => {
                    const focused = focusedIdx === i;
                    return (
                      <div
                        key={f.file_id}
                        ref={el => itemRefs.current[i] = el}
                        className={`tv-episode${focused ? " tv-episode--focused" : ""}`}
                        onClick={() => startPreload("browser", f)}
                        onMouseEnter={() => setFocusedIdx(i)}
                      >
                        <div className="tv-episode__num">E{String(f.episode).padStart(2, "0")}</div>
                        <div className="tv-episode__size">{formatSize(f.size)}</div>
                        {onSendToTv && (
                          <button
                            className="tv-episode__tv"
                            onClick={e => { e.stopPropagation(); startPreload("tv", f); }}
                            title="На TV"
                          >
                            <Tv size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Фільм: звичайний список файлів */
              <ul className="tv-list" ref={listRef}>
                {files.map((f, i) => {
                  const focused = focusedIdx === i;
                  return (
                    <li
                      key={i}
                      ref={el => itemRefs.current[i] = el}
                      className={`tv-item${focused ? " tv-item--focused" : ""}`}
                      onMouseEnter={() => setFocusedIdx(i)}
                    >
                      <div className="tv-item__body">
                        <div className="tv-item__title">{f.name}</div>
                        <div className="tv-item__row">
                          <span className="tv-pill">{formatSize(f.size)}</span>
                        </div>
                      </div>
                      <div className="tv-file-btns">
                        <button className="tv-file-btn tv-file-btn--play" onClick={() => startPreload("browser", f)}>
                          <Play size={14} /> Дивитись
                        </button>
                        {onSendToTv && (
                          <button className="tv-file-btn tv-file-btn--tv" onClick={() => startPreload("tv", f)}>
                            <Tv size={14} /> На TV
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* ── Preload step ── */}
        {step === "preload" && preloadInfo && (
          <div className="tv-preload">
            <div className="tv-preload__ring">
              <svg viewBox="0 0 64 64" className="tv-preload__svg">
                <circle cx="32" cy="32" r="28" className="tv-preload__track" />
                <circle cx="32" cy="32" r="28" className="tv-preload__arc"
                  style={{ strokeDashoffset: 176 - Math.min((preloadInfo.elapsed || 0) / 15, 1) * 176 }}
                />
              </svg>
              <Zap size={22} className="tv-preload__zap" />
            </div>
            <div className="tv-preload__title">Підготовка…</div>
            <div className="tv-preload__stats">
              <div className="tv-preload__stat">👥 {preloadInfo.peers} пірів</div>
            </div>
            {preloadInfo.stat_string ? (
              <div className="tv-preload__status">{preloadInfo.stat_string}</div>
            ) : null}
            <button className="tv-preload__skip" onClick={() => { clearInterval(pollRef.current); executeAction(pendingAction.type, pendingAction.file); }}>
              Пропустити →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
