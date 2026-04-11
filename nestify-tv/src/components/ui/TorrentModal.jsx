import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { searchTorrents, addTorrent, getTorrentStatus, removeTorrent, preloadTorrent, getFileInfo, startHlsSession } from "../../api/v3";
import { X, PlayCircle, Loader2, Zap } from "lucide-react";
import { getCurrentProfile } from "../../core/session";
import { getCachedTorrents, setCachedTorrents, makeTorrentCacheKey } from "../../core/torrentCache";

/* ─── helpers ──────────────────────────────────────────────── */
function formatSize(b) {
  if (!b) return "?";
  const gb = b / 1024 / 1024 / 1024;
  return gb >= 1 ? gb.toFixed(2) + " GB" : (b / 1024 / 1024).toFixed(0) + " MB";
}

function calcBitrate(sizeBytes, runtimeMinutes) {
  if (!sizeBytes || !runtimeMinutes) return null;
  const kbps = Math.round((sizeBytes * 8) / (runtimeMinutes * 60) / 1000);
  if (kbps <= 0) return null;
  return kbps >= 1000 ? (kbps / 1000).toFixed(1) + " Mbps" : kbps + " kbps";
}

function parseMeta(title, jacredQuality = null, videotype = "") {
  const t = title.toUpperCase();
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
  let hdr = null;
  const vt = (videotype || "").toLowerCase();
  if (vt.includes("dolby") || vt === "dv") hdr = "DV";
  else if (vt.includes("hdr")) hdr = "HDR";
  else if (t.includes("DOLBY VISION") || t.includes("DOLBY.VISION")) hdr = "DV";
  else if (t.includes("HDR")) hdr = "HDR";
  return { quality, source, hdr };
}

function parseEpisode(name) {
  const m = name.match(/S(\d+)E(\d+)/i);
  if (!m) return null;
  return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
}

function groupBySeason(files) {
  const map = new Map();
  for (const f of files) {
    const ep = parseEpisode(f.name);
    if (!ep) continue;
    const s = ep.season;
    if (!map.has(s)) map.set(s, []);
    map.get(s).push({ ...f, season: ep.season, episode: ep.episode });
  }
  for (const [s, eps] of map) map.set(s, eps.sort((a, b) => a.episode - b.episode));
  return map;
}

function extractBtih(magnet) {
  if (!magnet) return null;
  const m = magnet.match(/xt=urn:btih:([a-f0-9]+)/i);
  return m ? m[1].toLowerCase() : null;
}

const QUALITY_COLOR = { "4K": "#f59e0b", "1080p": "#60a5fa", "720p": "#34d399", "480p": "#9ca3af" };

// TV remote keycodes
const BACK_CODES  = new Set([8, 27, 461, 10009, 88]);
const ENTER_CODES = new Set([13, 29443, 65385, 117]);
const UP_CODES    = new Set([38, 29460]);
const DOWN_CODES  = new Set([40, 29461]);
const LEFT_CODES  = new Set([37, 4]);
const RIGHT_CODES = new Set([39, 5]);

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
  const [step, setStep]               = useState("search");
  const [preloadInfo, setPreloadInfo] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [langTab, setLangTab]         = useState(() => getCurrentProfile()?.default_lang || "best");
  const [qualityFilter, setQualityFilter] = useState(null);
  const [focusedIdx, setFocusedIdx]   = useState(0);
  const [focusZone, setFocusZone]     = useState("list");
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [visible, setVisible]         = useState(false);
  const panelRef                      = useRef(null);

  const pollRef           = useRef(null);
  const playingRef        = useRef(false);
  const listRef           = useRef(null);
  const itemRefs          = useRef([]);
  const langRefs          = useRef([]);
  const qualityRefs       = useRef([]);
  const seasonRefs        = useRef([]);
  const selectedMagnetRef = useRef(null);

  /* ── slide-in animation ── */
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };

  /* ── hide mini player ── */
  useEffect(() => {
    document.body.classList.add("torrent-modal-open");
    return () => document.body.classList.remove("torrent-modal-open");
  }, []);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [visible]);

  useEffect(() => {
    setFocusZone("list");
    setFocusedIdx(0);
  }, [step, langTab, qualityFilter, selectedSeason]);

  /* ── lock body scroll ── */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── season grouping ── */
  const seasonMap        = useMemo(() => groupBySeason(files), [files]);
  const isSeries         = seasonMap.size > 0;
  const seasons          = useMemo(() => [...seasonMap.keys()].sort((a, b) => a - b), [seasonMap]);
  const episodesInSeason = selectedSeason !== null ? (seasonMap.get(selectedSeason) || []) : [];

  useEffect(() => {
    if (isSeries && seasons.length > 0 && selectedSeason === null) setSelectedSeason(seasons[0]);
  }, [isSeries, seasons, selectedSeason]);

  /* ── search ── */
  const doSearch = useCallback(async () => {
    const cacheKey = makeTorrentCacheKey({ tmdbId, mediaType, title: title || titleOriginal });
    const cached = getCachedTorrents(cacheKey);
    if (cached) {
      setResults(cached); setFocusedIdx(0);
      const total = cached.uk.length + cached.ru.length + cached.en.length + cached.pl.length;
      if (!total) setError("Нічого не знайдено");
      return;
    }
    setError(null); setLoading(true); setResults({ uk: [], ru: [], en: [], pl: [] }); setFocusedIdx(0);
    try {
      const data = await searchTorrents({
        q: title || titleOriginal || "",
        title, title_original: titleOriginal || title,
        title_en: titleEnglish || undefined, title_pl: titlePolish || undefined,
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
    let fileDurationSeconds = null;
    let hlsSessionId = null;
    let hlsPlaylistUrl = null;
    getFileInfo(hash, file.file_id).then(info => {
      const d = info?.format?.duration;
      if (d) fileDurationSeconds = parseFloat(d);
    }).catch(() => {});
    if (type === "browser") {
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
        if (elapsed >= 10) { clearInterval(pollRef.current); executeAction(type, file, fileDurationSeconds, hlsSessionId, hlsPlaylistUrl); }
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
      const tvFile = { ...file, stream_url: file.stream_url_direct || file.stream_url, hash: currentHash };
      if (onSendToTv) onSendToTv(tvFile);
    }
    onClose();
  }, [onPlayInBrowser, onSendToTv, onClose, currentHash]);

  useEffect(() => () => {
    clearInterval(pollRef.current);
    if (currentHash && !playingRef.current) removeTorrent(currentHash).catch(() => {});
  }, [currentHash]);

  /* ── tab/filter results ── */
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
    if (qualityFilter) items = items.filter(t => parseMeta(t.title, t.quality, t.videotype).quality === qualityFilter);
    return items;
  }, [results, langTab, qualityFilter]);

  const activeList = step === "files" ? (isSeries ? episodesInSeason : files) : tabResults;

  /* ── scroll focused item into view ── */
  useEffect(() => {
    const refMap = {
      list: itemRefs.current,
      langs: langRefs.current,
      qualities: qualityRefs.current,
      seasons: seasonRefs.current,
    };
    const el = refMap[focusZone]?.[focusedIdx];
    if (el) {
      el.focus?.({ preventScroll: true });
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }, [focusedIdx, focusZone]);

  /* ── keyboard — CAPTURE phase, blocks everything behind ── */
  useEffect(() => {
    // Compute visible lang options
    const langOptions = [
      { key: "best", count: results.uk.length + results.ru.length + results.en.length + results.pl.length },
      { key: "uk",   count: results.uk.length },
      { key: "ru",   count: results.ru.length },
      { key: "en",   count: results.en.length },
      { key: "pl",   count: results.pl.length },
    ].filter(({ count }) => count > 0);

    // Quality options including "Всі"
    const qualityOptions = [null, ...availableQualities]; // null = "Всі"

    const zoneSize = {
      langs:     langOptions.length,
      qualities: qualityOptions.length,
      seasons:   seasons.length,
      list:      activeList.length,
    };

    const onKey = (e) => {
      const code = e.keyCode || e.which;
      const isOurs = BACK_CODES.has(code) || ENTER_CODES.has(code) ||
                     UP_CODES.has(code)   || DOWN_CODES.has(code)  ||
                     LEFT_CODES.has(code) || RIGHT_CODES.has(code);
      if (!isOurs) return;
      e.preventDefault();
      e.stopImmediatePropagation();

      // ── Preload: ENTER/BACK = skip ──
      if (step === "preload") {
        if (ENTER_CODES.has(code) || BACK_CODES.has(code)) {
          clearInterval(pollRef.current);
          if (pendingAction) executeAction(pendingAction.type, pendingAction.file);
        }
        return;
      }

      // ── BACK: close panel or go to previous step ──
      if (BACK_CODES.has(code)) {
        if (focusZone !== "list") {
          // escape top zone back to list
          setFocusZone("list"); setFocusedIdx(0);
        } else if (step === "files") {
          setStep("search"); setFiles([]); setCurrentHash(null);
          setFocusedIdx(0); setSelectedIdx(null); setSelectedSeason(null);
        } else {
          handleClose();
        }
        return;
      }

      // ── LEFT/RIGHT: navigate within top zones ──
      if (LEFT_CODES.has(code) || RIGHT_CODES.has(code)) {
        const dir = LEFT_CODES.has(code) ? -1 : 1;

        if (focusZone === "list") {
          // LEFT from list → nothing (don't close, don't change zone)
          return;
        }
        // Navigate within current zone
        const size = zoneSize[focusZone] ?? 0;
        setFocusedIdx(i => Math.max(0, Math.min(size - 1, i + dir)));
        return;
      }

      // ── UP: move up in list, or escape to top zone ──
      if (UP_CODES.has(code)) {
        if (focusZone === "list") {
          if (focusedIdx > 0) {
            setFocusedIdx(i => i - 1);
          } else {
            // at top of list → go to top zone
            if (step === "search" && availableQualities.length > 0) {
              setFocusZone("qualities");
              setFocusedIdx(qualityOptions.indexOf(qualityFilter) >= 0 ? qualityOptions.indexOf(qualityFilter) : 0);
            } else if (step === "search" && langOptions.length > 0) {
              setFocusZone("langs");
              setFocusedIdx(Math.max(0, langOptions.findIndex(l => l.key === langTab)));
            } else if (step === "files" && seasons.length > 1) {
              setFocusZone("seasons");
              setFocusedIdx(Math.max(0, seasons.indexOf(selectedSeason)));
            }
          }
        } else if (focusZone === "qualities") {
          // UP from quality → go to langs
          if (langOptions.length > 0) {
            setFocusZone("langs");
            setFocusedIdx(Math.max(0, langOptions.findIndex(l => l.key === langTab)));
          }
        } else {
          // UP from langs → stay (already topmost)
        }
        return;
      }

      // ── DOWN: move down in list, or descend from top zone ──
      if (DOWN_CODES.has(code)) {
        if (focusZone === "langs") {
          // DOWN from langs → quality (if any), else list
          if (availableQualities.length > 0) {
            setFocusZone("qualities");
            setFocusedIdx(qualityOptions.indexOf(qualityFilter) >= 0 ? qualityOptions.indexOf(qualityFilter) : 0);
          } else {
            setFocusZone("list"); setFocusedIdx(0);
          }
        } else if (focusZone === "qualities" || focusZone === "seasons") {
          setFocusZone("list"); setFocusedIdx(0);
        } else {
          // in list
          setFocusedIdx(i => Math.min(activeList.length - 1, i + 1));
        }
        return;
      }

      // ── ENTER: confirm selection in current zone ──
      if (ENTER_CODES.has(code)) {
        if (focusZone === "langs") {
          const opt = langOptions[focusedIdx];
          if (opt) {
            setLangTab(opt.key); setQualityFilter(null); setSelectedIdx(null);
            setFocusZone("list"); setFocusedIdx(0);
          }
          return;
        }
        if (focusZone === "qualities") {
          setQualityFilter(qualityOptions[focusedIdx] ?? null);
          setSelectedIdx(null);
          setFocusZone("list"); setFocusedIdx(0);
          return;
        }
        if (focusZone === "seasons") {
          const s = seasons[focusedIdx];
          if (s != null) { setSelectedSeason(s); setFocusZone("list"); setFocusedIdx(0); }
          return;
        }
        // list zone
        if (step === "search") {
          const t = tabResults[focusedIdx];
          if (t) { setSelectedIdx(focusedIdx); handleSelectTorrent(t, focusedIdx); }
        }
        if (step === "files") {
          const f = isSeries ? episodesInSeason[focusedIdx] : files[focusedIdx];
          if (f) startPreload("browser", f);
        }
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [step, focusZone, focusedIdx, tabResults, files, activeList, isSeries, episodesInSeason,
      availableQualities, seasons, selectedSeason, langTab, qualityFilter, results,
      handleSelectTorrent, startPreload, handleClose, pendingAction, executeAction]);

  /* ─── render ─────────────────────────────────────────────── */
  const panel = (
    <div
      className={`tv-overlay${visible ? " tv-overlay--in" : ""}`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className={`tv-panel${visible ? " tv-panel--in" : ""}`}>
        <div
          ref={panelRef}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0 }}
        />

        {/* Handle */}
        <div className="tv-handle" />

        {/* Top bar */}
        <div className="tv-topbar">
          <div />
          <div className="tv-topbar__info">
            <span className="tv-topbar__movie">{title || titleOriginal}</span>
            {year && <span className="tv-topbar__year">{year}</span>}
          </div>
          <button className="tv-close" onClick={handleClose}><X size={14} /></button>
        </div>

        {/* ── Search step ── */}
        {step === "search" && (
          <>
            {!loading && (
              <div className="tv-langs">
                {[
                  { key: "best", icon: null, text: "Кращі", count: results.uk.length + results.ru.length + results.en.length + results.pl.length },
                  { key: "uk",   icon: "/images/ua.svg", text: "Укр", count: results.uk.length },
                  { key: "ru",   icon: "/images/ru.svg", text: "Рус", count: results.ru.length },
                  { key: "en",   icon: "/images/us.svg", text: "Eng", count: results.en.length },
                  { key: "pl",   icon: "/images/pl.svg", text: "Pol", count: results.pl.length },
                ].map(({ key, icon, text, count }, i) => count > 0 && (
                  <button
                    key={key}
                    ref={el => (langRefs.current[i] = el)}
                    tabIndex={focusZone === "langs" && focusedIdx === i ? 0 : -1}
                    className={`tv-lang${langTab === key ? " tv-lang--on" : ""}`}
                    data-focused={focusZone === "langs" && focusedIdx === i ? "true" : "false"}
                    onClick={() => { setLangTab(key); setFocusedIdx(0); setQualityFilter(null); setSelectedIdx(null); }}
                  >
                    {icon ? <img src={icon} alt={text} className="tv-lang__flag" /> : <Zap size={13} />}
                    {text}<span className="tv-lang__n">{key === "best" ? "30" : count}</span>
                  </button>
                ))}
              </div>
            )}

            {!loading && availableQualities.length > 1 && (
              <div className="tv-qfilter">
                <button
                  ref={el => (qualityRefs.current[0] = el)}
                  tabIndex={focusZone === "qualities" && focusedIdx === 0 ? 0 : -1}
                  className={`tv-qf-btn${qualityFilter === null ? " tv-qf-btn--on" : ""}`}
                  data-focused={focusZone === "qualities" && focusedIdx === 0 ? "true" : "false"}
                  onClick={() => { setQualityFilter(null); setFocusedIdx(0); }}>Всі</button>
                {availableQualities.map((q, i) => (
                  <button key={q}
                    ref={el => (qualityRefs.current[i + 1] = el)}
                    tabIndex={focusZone === "qualities" && focusedIdx === i + 1 ? 0 : -1}
                    className={`tv-qf-btn${qualityFilter === q ? " tv-qf-btn--on" : ""}`}
                    data-focused={focusZone === "qualities" && focusedIdx === i + 1 ? "true" : "false"}
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
                  const isFocused  = focusZone === "list" && focusedIdx === i;
                  const isWatched  = watchedBtih && extractBtih(t.magnet) === watchedBtih;
                  const isSelected = selectedIdx === i;
                  return (
                    <li
                      key={i}
                      ref={el => (itemRefs.current[i] = el)}
                      tabIndex={focusZone === "list" && isFocused ? 0 : -1}
                      className={[
                        "tv-item",
                        isFocused  ? "tv-item--focused"  : "",
                        t.seeders === 0 ? "tv-item--dead" : "",
                        addingIdx === i ? "tv-item--loading" : "",
                        isWatched  ? "tv-item--watched"  : "",
                        isSelected ? "tv-item--selected" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => { setSelectedIdx(i); setFocusedIdx(i); handleSelectTorrent(t, i); }}
                      onMouseEnter={() => setFocusedIdx(i)}
                    >
                      <div className="tv-item__body">
                        <div className="tv-item__title">{t.title}</div>
                        <div className="tv-item__row">
                          {(t.voices || []).slice(0, 2).map(v => <span key={v} className="tv-pill tv-pill--voice">{v}</span>)}
                          {meta.source && <span className="tv-pill tv-pill--src">{meta.source}</span>}
                          {meta.hdr    && <span className="tv-pill tv-pill--hdr">{meta.hdr}</span>}
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
                          : <div className={`tv-radio${isSelected ? " tv-radio--on" : ""}`} />
                        }
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* ── Files step ── */}
        {step === "files" && (
          <>
            <button className="tv-back"
              onClick={() => { setStep("search"); setFiles([]); setCurrentHash(null); setFocusedIdx(0); setSelectedIdx(null); setSelectedSeason(null); }}>
              ← Назад до результатів
            </button>

            {files.length === 0 && <div className="tv-error">Відео-файли не знайдено</div>}

            {isSeries ? (
              <>
                {seasons.length > 1 && (
                  <div className="tv-seasons">
                    {seasons.map((s, i) => (
                  <button key={s}
                        ref={el => (seasonRefs.current[i] = el)}
                        tabIndex={focusZone === "seasons" && focusedIdx === i ? 0 : -1}
                        className={`tv-season-tab${selectedSeason === s ? " tv-season-tab--on" : ""}`}
                        data-focused={focusZone === "seasons" && focusedIdx === i ? "true" : "false"}
                        onClick={() => { setSelectedSeason(s); setFocusedIdx(0); }}
                      >
                        Сезон {s}<span className="tv-lang__n">{seasonMap.get(s).length}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="tv-episodes" ref={listRef}>
                  {episodesInSeason.map((f, i) => (
                    <div
                      key={f.file_id}
                      ref={el => (itemRefs.current[i] = el)}
                      tabIndex={focusedIdx === i ? 0 : -1}
                      className={`tv-episode${focusZone === "list" && focusedIdx === i ? " tv-episode--focused" : ""}`}
                      onClick={() => startPreload("browser", f)}
                      onMouseEnter={() => setFocusedIdx(i)}
                    >
                      <div className="tv-episode__num">E{String(f.episode).padStart(2, "0")}</div>
                      <div className="tv-episode__size">{formatSize(f.size)}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <ul className="tv-file-list" ref={listRef}>
                {files.map((f, i) => {
                  const focused = focusZone === "list" && focusedIdx === i;
                  return (
                    <li
                      key={i}
                      ref={el => (itemRefs.current[i] = el)}
                      tabIndex={focused ? 0 : -1}
                      className={`tv-file-card${focused ? " tv-file-card--focused" : ""}`}
                      onMouseEnter={() => setFocusedIdx(i)}
                    >
                      <div className="tv-file-card__meta">
                        <div className="tv-file-card__name">{f.name}</div>
                        <span className="tv-file-card__size">{formatSize(f.size)}</span>
                      </div>
                      <div className="tv-file-card__actions">
                        <button
                          className="tv-file-card__btn tv-file-card__btn--play"
                          onClick={() => startPreload("browser", f)}
                        >
                          <PlayCircle size={20} />
                          Дивитись
                        </button>
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
                  style={{ strokeDashoffset: 176 - Math.min((preloadInfo.elapsed || 0) / 15, 1) * 176 }} />
              </svg>
              <Zap size={22} className="tv-preload__zap" />
            </div>
            <div className="tv-preload__title">Підготовка…</div>
            <div className="tv-preload__stats">
              <div className="tv-preload__stat">👥 {preloadInfo.peers} пірів</div>
            </div>
            {preloadInfo.stat_string && <div className="tv-preload__status">{preloadInfo.stat_string}</div>}
            <button className="tv-preload__skip"
              onClick={() => { clearInterval(pollRef.current); executeAction(pendingAction.type, pendingAction.file); }}>
              Пропустити →
            </button>
          </div>
        )}

        {/* ── Nav hint ── */}
        {step !== "preload" && (
          <div className="tv-nav-hint">
            <span>↑↓ навігація</span>
            <span>OK вибрати</span>
            <span>← назад</span>
          </div>
        )}

      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
