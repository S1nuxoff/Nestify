import React, { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function DomemPlayerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { imdbId } = useParams();

  const embedUrl = useMemo(() => {
    const fromState = location.state?.embed?.embed_url;
    if (fromState) return fromState;
    if (imdbId) return `https://api.domem.ws/embed/imdb/${imdbId}`;
    return "";
  }, [location.state, imdbId]);

  if (!embedUrl) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
      }}>
        <div>Не вдалося відкрити плеєр.</div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            borderRadius: 999,
            padding: "10px 18px",
            cursor: "pointer",
          }}
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 9999 }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Назад"
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 2,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          borderRadius: 999,
          padding: "10px 16px",
          cursor: "pointer",
          backdropFilter: "blur(10px)",
        }}
      >
        ← Назад
      </button>

      <iframe
        title="Domem Player"
        src={embedUrl}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          background: "#000",
        }}
      />
    </div>
  );
}
