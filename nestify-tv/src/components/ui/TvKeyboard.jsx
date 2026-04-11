import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, X } from "lucide-react";
import "../../styles/TvKeyboard.css";

// ── Key layouts (lowercase base) ──────────────────────────────────────────
const ROWS_UK = [
  ["й","ц","у","к","е","н","г","ш","щ","з","х","ї"],
  ["ф","и","в","а","п","р","о","л","д","ж","є"],
  ["⇧","я","ч","с","м","т","ь","б","ю",".","!","?"],
  ["1","2","3","4","5","6","7","8","9","0","-"],
  ["⌫","ПРОБІЛ","ОК"],
];

const ROWS_EN = [
  ["q","w","e","r","t","y","u","i","o","p","@"],
  ["a","s","d","f","g","h","j","k","l",".","-"],
  ["⇧","z","x","c","v","b","n","m","_","!","?","#"],
  ["1","2","3","4","5","6","7","8","9","0","+"],
  ["⌫","SPACE","OK"],
];

// Keys that should NOT be uppercased
const SPECIAL_KEYS = new Set([
  "⌫","⇧","ПРОБІЛ","SPACE","ОК","OK",
  "1","2","3","4","5","6","7","8","9","0",
  "-",".","!","?","@","_","#","+","є","ї","є",
]);

function applyShift(key) {
  if (SPECIAL_KEYS.has(key)) return key;
  return key.toUpperCase();
}

const BACK_CODES  = new Set([8, 27, 461, 10009, 88]);
const ENTER_CODES = new Set([13, 29443, 65385, 117]);
const UP_CODES    = new Set([38, 29460]);
const DOWN_CODES  = new Set([40, 29461]);
const LEFT_CODES  = new Set([37, 4]);
const RIGHT_CODES = new Set([39, 5]);

export default function TvKeyboard({ value, onChange, onClose, masked = false, layout = "uk" }) {
  const [lang,    setLang]    = useState(layout);
  const [shift,   setShift]   = useState(false); // uppercase mode
  const [row,     setRow]     = useState(0);
  const [col,     setCol]     = useState(0);

  const ROWS = lang === "en" ? ROWS_EN : ROWS_UK;

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const safeCol = (r, c) => Math.min(c, ROWS[r].length - 1);

  const pressKey = useCallback((rawKey) => {
    // Special keys ignore shift
    if (rawKey === "⌫")                           { onChange(value.slice(0, -1)); return; }
    if (rawKey === "ПРОБІЛ" || rawKey === "SPACE") { onChange(value + " "); return; }
    if (rawKey === "ОК"     || rawKey === "OK")    { onClose(value); return; }
    if (rawKey === "⇧")                            { setShift(s => !s); return; }

    const char = shift ? applyShift(rawKey) : rawKey;
    onChange(value + char);
    // Auto-disable shift after one uppercase letter (like phone keyboard)
    if (shift) setShift(false);
  }, [value, onChange, onClose, shift]);

  // ── Voice search ──────────────────────────────────────────────────────
  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    const rec = new SR();
    rec.lang = "uk-UA";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = () => setListening(false);
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript || "";
      if (text) { onChange(text); onClose(text); }
    };
    recognitionRef.current = rec;
    rec.start();
  }, [onChange, onClose]);

  const stopVoice = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  // ── D-pad capture ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const code = e.keyCode || e.which;
      e.preventDefault();
      e.stopImmediatePropagation();

      if (BACK_CODES.has(code))  { onClose(value); return; }
      if (ENTER_CODES.has(code)) { pressKey(ROWS[row][safeCol(row, col)]); return; }

      if (UP_CODES.has(code)) {
        setRow((r) => { const nr = Math.max(0, r - 1); setCol((c) => safeCol(nr, c)); return nr; });
        return;
      }
      if (DOWN_CODES.has(code)) {
        setRow((r) => { const nr = Math.min(ROWS.length - 1, r + 1); setCol((c) => safeCol(nr, c)); return nr; });
        return;
      }
      if (LEFT_CODES.has(code))  { setCol((c) => Math.max(0, c - 1)); return; }
      if (RIGHT_CODES.has(code)) { setCol((c) => Math.min(ROWS[row].length - 1, c + 1)); return; }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      try { recognitionRef.current?.stop(); } catch {}
    };
  }, [row, col, pressKey, value, onClose, ROWS]);

  const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const displayValue = masked && value ? "●".repeat(value.length) : value;

  return createPortal(
    <div className="tvkb-overlay">
      {/* ── Display bar ── */}
      <div className="tvkb-display">
        <div className="tvkb-display__text">
          {value
            ? <><span>{displayValue}</span><span className="tvkb-cursor" /></>
            : <span className="tvkb-placeholder">Введіть…</span>
          }
        </div>
        <div className="tvkb-display__actions">
          <button
            className="tvkb-lang"
            onClick={() => { setLang(l => l === "uk" ? "en" : "uk"); setRow(0); setCol(0); setShift(false); }}
          >
            {lang === "uk" ? "EN" : "UA"}
          </button>
          {hasSR && (
            <button className={`tvkb-mic${listening ? " tvkb-mic--active" : ""}`} onClick={listening ? stopVoice : startVoice}>
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <button className="tvkb-close" onClick={() => onClose(value)}>
            <X size={20} />
          </button>
        </div>
      </div>

      {listening && (
        <div className="tvkb-listening">
          <span className="tvkb-listening__dot" />
          <span className="tvkb-listening__dot" />
          <span className="tvkb-listening__dot" />
          <span className="tvkb-listening__label">Слухаю…</span>
        </div>
      )}

      {/* ── Key grid ── */}
      <div className="tvkb-grid">
        {ROWS.map((keys, r) => (
          <div key={r} className="tvkb-row">
            {keys.map((key, c) => {
              const focused  = r === row && c === safeCol(row, col);
              const isShift  = key === "⇧";
              const isWide   = key === "ПРОБІЛ" || key === "SPACE" || key === "ОК" || key === "OK" || key === "⌫";
              const isOk     = key === "ОК" || key === "OK";
              const display  = (shift && !SPECIAL_KEYS.has(key)) ? key.toUpperCase() : key;

              return (
                <button
                  key={c}
                  className={[
                    "tvkb-key",
                    focused         ? "tvkb-key--focused" : "",
                    isWide          ? "tvkb-key--wide"    : "",
                    isOk            ? "tvkb-key--ok"      : "",
                    isShift && shift? "tvkb-key--shift-on" : "",
                    isShift         ? "tvkb-key--shift"   : "",
                  ].filter(Boolean).join(" ")}
                  tabIndex={focused ? 0 : -1}
                  onClick={() => pressKey(key)}
                >
                  {display}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
