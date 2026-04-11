import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaCard from "../components/ui/MediaCard";
import MovieCast from "../components/movie/MovieCast";
import { getPersonDetails, getMovieDetails, getTvDetails, normalizeTmdbItem, tmdbImg } from "../api/tmdb";
import "../styles/TmdbPersonPage.css";

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("uk-UA", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function calcAge(birthday) {
  if (!birthday) return null;
  const diff = Date.now() - new Date(birthday).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function dedupeCredits(items) {
  const map = new Map();
  for (const item of items || []) {
    if (item?.media_type !== "movie" && item?.media_type !== "tv") continue;
    const key = `${item.media_type}:${item.id}`;
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

function normalizeCredits(items) {
  return dedupeCredits(items)
    .sort((a, b) => {
      const aDate = a.release_date || a.first_air_date || "";
      const bDate = b.release_date || b.first_air_date || "";
      return new Date(bDate || 0) - new Date(aDate || 0);
    })
    .map((item) => normalizeTmdbItem(item));
}

function getRoles(person) {
  if (!person) return [];
  const roles = new Set();
  if (person.known_for_department) roles.add(person.known_for_department);
  const jobs = (person.combined_credits?.crew || []).map((c) => c.job).filter(Boolean);
  for (const job of ["Director", "Producer", "Writer", "Composer"]) {
    if (jobs.includes(job)) roles.add(job);
  }
  return Array.from(roles).slice(0, 4);
}

function translateRole(role) {
  const map = {
    Acting: "Актор",
    Directing: "Режисер",
    Director: "Режисер",
    Producer: "Продюсер",
    Writing: "Сценарист",
    Writer: "Сценарист",
    Composer: "Композитор",
    Sound: "Звук",
    Art: "Художник",
  };
  return map[role] || role;
}

export default function TmdbPersonPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const personId = params.personId || location.pathname.split("/person/")[1]?.split("/")[0];

  const sheetRef = useRef(null);
  const drag = useRef({ active: false, startY: 0, dy: 0 });
  const [pullY, setPullY] = useState(0);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coActors, setCoActors] = useState([]);

  useEffect(() => {
    const el = document.querySelector(".route-sheet-wrapper");
    if (!el) return;
    sheetRef.current = el;

    const onStart = (e) => {
      if (el.scrollTop > 0) return;
      drag.current = { active: true, startY: e.touches[0].clientY, dy: 0 };
    };
    const onMove = (e) => {
      if (!drag.current.active) return;
      const dy = e.touches[0].clientY - drag.current.startY;
      if (dy <= 0) { drag.current.active = false; setPullY(0); return; }
      e.preventDefault();
      drag.current.dy = dy;
      setPullY(dy / (1 + dy * 0.008));
    };
    const onEnd = () => {
      if (!drag.current.active) return;
      drag.current.active = false;
      if (drag.current.dy >= 100) navigate(-1);
      else setPullY(0);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.style.transform = "";
      el.style.transition = "";
      el.style.borderRadius = "";
    };
  }, [navigate]);

  // Apply drag transform directly to sheet wrapper
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    if (pullY > 0) {
      el.style.transform = `translateY(${pullY}px)`;
      el.style.transition = "none";
      el.style.borderRadius = `${Math.min(pullY * 0.15, 20)}px ${Math.min(pullY * 0.15, 20)}px 0 0`;
    } else {
      el.style.transform = "";
      el.style.transition = "transform 0.3s ease";
      el.style.borderRadius = "";
    }
  }, [pullY]);


  useEffect(() => {
    if (!personId) return;
    setLoading(true);
    getPersonDetails(personId)
      .then(setPerson)
      .catch(() => setPerson(null))
      .finally(() => setLoading(false));
  }, [personId]);

  const filmography = useMemo(() =>
    normalizeCredits([
      ...(person?.combined_credits?.cast || []),
      ...(person?.combined_credits?.crew || []),
    ]), [person]);

  // Load co-actors from the person's top movie
  useEffect(() => {
    if (!person) return;
    const topCredit = (person.combined_credits?.cast || [])
      .filter((c) => c.media_type === "movie" || c.media_type === "tv")
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0];
    if (!topCredit) return;
    const fetch = topCredit.media_type === "tv" ? getTvDetails : getMovieDetails;
    fetch(topCredit.id).then((details) => {
      const cast = (details.credits?.cast || [])
        .filter((a) => a.id !== Number(personId))
        .slice(0, 20)
        .map((a) => ({
          id: a.id,
          personId: a.id,
          name: a.name,
          photo: tmdbImg(a.profile_path, "w185"),
          job: a.character,
        }));
      setCoActors(cast);
    }).catch(() => {});
  }, [person, personId]);

  const handleMovieSelect = (movie) => {
    navigate(`/title/${movie.mediaType || "movie"}/${movie.tmdbId}`);
  };

  if (loading) {
    return (
      <div className="pp-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>Завантаження…</span>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="pp-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>Не вдалося завантажити</span>
      </div>
    );
  }

  const profileImg = tmdbImg(person.profile_path, "w780");
  const age = calcAge(person.birthday);
  const roles = getRoles(person);

  // Year range of projects
  const allDates = filmography
    .map((f) => f.filmDecribe)
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 1900);
  const yearMin = allDates.length ? Math.min(...allDates) : null;
  const yearMax = allDates.length ? Math.max(...allDates) : null;

  const infoRows = [
    person.birthday && {
      label: "Дата народження",
      value: `${formatDate(person.birthday)}${age ? ` (${age} р.)` : ""}`,
    },
    (person.also_known_as || []).length > 0 && {
      label: "Ім'я при народженні",
      value: person.also_known_as[0],
    },
    person.place_of_birth && { label: "Місце народження", value: person.place_of_birth },
    filmography.length > 0 && {
      label: "Всі проєкти",
      value: `${filmography.length}${yearMin && yearMax ? `, ${yearMin}–${yearMax}` : ""}`,
    },
  ].filter(Boolean);

  return (
    <div
      className="pp-root"
    >
      {/* Hero */}
      <div className="pp-hero">
        {profileImg ? (
          <img className="pp-hero__img" src={profileImg} alt={person.name} />
        ) : (
          <div className="pp-hero__img" style={{ background: "rgba(255,255,255,0.05)" }} />
        )}
        <div className="pp-hero__gradient" />

        <button className="pp-hero__back" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </button>

        <div className="pp-hero__bottom">
          <h1 className="pp-hero__name">{person.name}</h1>
          {roles.length > 0 && (
            <div className="pp-hero__roles">
              {roles.map((r) => (
                <span key={r} className="pp-hero__role">{translateRole(r)}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info rows */}
      {infoRows.length > 0 && (
        <div className="pp-info">
          {infoRows.map((row) => (
            <div key={row.label} className="pp-info-row">
              <span className="pp-info-row__label">{row.label}</span>
              <span className="pp-info-row__value">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filmography */}
      {filmography.length > 0 && (
        <div className="pp-section">
          <div className="pp-section__head">
            <span className="pp-section__title">Фільмографія</span>
            <ChevronRight size={20} className="pp-section__arrow" />
          </div>
          <div className="pp-hscroll">
            {filmography.slice(0, 20).map((m, i) => (
              <div key={i} className="pp-hscroll__item">
                <MediaCard movie={m} onMovieSelect={handleMovieSelect} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Co-actors */}
      {coActors.length > 0 && (
        <div className="pp-coactors">
          <MovieCast actors={coActors} title="Знімалися разом" />
        </div>
      )}
    </div>
  );
}
