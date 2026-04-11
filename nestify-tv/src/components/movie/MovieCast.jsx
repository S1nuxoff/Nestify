import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/MovieCast.css";

const MovieCast = ({ actors = [], title = "Актори" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const list = useMemo(() => {
    if (!Array.isArray(actors)) return [];
    const map = new Map();

    for (const a of actors) {
      const key = a?.id || a?.url || a?.name;
      if (!key) continue;
      if (!map.has(key)) map.set(key, a);
    }

    return Array.from(map.values());
  }, [actors]);

  if (!list.length) return null;

  return (
    <section className="movie-cast">
      <div className="movie-cast__head">
        <h2 className="movie-section-title">{title}</h2>
        <span className="movie-cast__count">{list.length}</span>
      </div>

      <div className="movie-cast__rail tv-hscroll">
        {list.map((a) => {
          const name = a?.name || "Без імені";
          const job = a?.job || "";
          const img = a?.photo || null;
          const href = a?.url || null;
          const personId = a?.personId || a?.id || null;

          const initials = name
            .split(" ")
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join("");

          const CardTag = href ? "a" : "button";
          const cardProps = href
            ? { href, target: "_blank", rel: "noreferrer" }
            : {
                type: "button",
                onClick: () => {
                  if (personId) navigate(`/person/${personId}`, { state: { backgroundLocation: location.state?.backgroundLocation || location } });
                },
              };

          return (
            <CardTag
              key={a?.id || a?.url || name}
              className="movie-cast__card"
              {...cardProps}
            >
              <div className="movie-cast__avatar">
                {img ? (
                  <img
                    src={img}
                    alt={name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="movie-cast__fallback">{initials || "•"}</div>
                )}
              </div>

              <div className="movie-cast__meta">
                <div className="movie-cast__name" title={name}>
                  {name}
                </div>
                {job && (
                  <div className="movie-cast__job" title={job}>
                    {job}
                  </div>
                )}
              </div>
            </CardTag>
          );
        })}
      </div>
    </section>
  );
};

export default MovieCast;
