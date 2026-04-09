import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info, X } from "lucide-react";
import { getWatchHistory } from "../api/v3";
import { getWatchHistory as getLegacyHistory } from "../api/hdrezka";
import { tmdbImg } from "../api/tmdb";
import axios from "axios";
import config from "../core/config";
import Header from "../components/layout/Header";
import "../styles/HistoryPage.css";

function parseTmdbId(movie_id) {
  const match = String(movie_id).match(/^tmdb_(movie|tv)_(\d+)$/);
  if (match) return { mediaType: match[1], tmdbId: match[2] };
  return null;
}

function formatTime(sec) {
  if (!sec) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}г ${m}хв`;
  return `${m}хв`;
}

function timeAgo(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} хв тому`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} год тому`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн тому`;
  return new Date(isoStr).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

function WatchStats({ newItems, legacySeconds }) {
  const newSeconds = newItems.reduce((s, i) => s + (i.position_seconds || 0), 0);
  const totalSec = newSeconds + (legacySeconds || 0);
  if (totalSec < 60) return null;

  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const timeStr = h > 0 ? `${h}г ${m}хв` : `${m}хв`;

  const hours = totalSec / 3600;
  let fact, factLabel;
  if (hours >= 48) { fact = (hours / 24).toFixed(1); factLabel = "доби без сну"; }
  else if (hours >= 10) { fact = Math.floor(hours / 10); factLabel = "перельоти Київ → NY"; }
  else { fact = Math.floor(totalSec / 2700); factLabel = "серії по 45 хв"; }

  return (
    <div className="watch-stats">
      <div className="watch-stats__item">
        <span className="watch-stats__value">{timeStr}</span>
        <span className="watch-stats__label">переглянуто за весь час</span>
      </div>
      <div className="watch-stats__item">
        <span className="watch-stats__value">{newItems.length}</span>
        <span className="watch-stats__label">нових тайтлів</span>
      </div>
      <div className="watch-stats__item">
        <span className="watch-stats__value">{fact}</span>
        <span className="watch-stats__label">{factLabel}</span>
      </div>
    </div>
  );
}

function MigrationBanner({ legacyCount, legacySeconds, onDismiss }) {
  if (!legacyCount) return null;

  const h = Math.floor(legacySeconds / 3600);
  const m = Math.floor((legacySeconds % 3600) / 60);
  const timeStr = h > 0 ? `${h} год ${m} хв` : `${m} хв`;

  return (
    <div className="migration-banner">
      <div className="migration-banner__icon"><Info size={20} /></div>
      <div className="migration-banner__body">
        <div className="migration-banner__title">Платформа оновилась</div>
        <div className="migration-banner__text">
          До оновлення ти переглянув <strong>{legacyCount} тайтлів</strong> і
          провів за переглядом <strong>{timeStr}</strong> — ці дані збережені
          в загальній статистиці зверху. Нова історія відображає фільми,
          переглянуті після переходу на нову платформу.
        </div>
      </div>
      <button className="migration-banner__close" onClick={onDismiss}><X size={16} /></button>
    </div>
  );
}

function HistoryCard({ item, tmdbData, onClick }) {
  const progress = item.duration > 0
    ? Math.min((item.position_seconds / item.duration) * 100, 100)
    : null;

  const poster = tmdbData?.poster_path ? tmdbImg(tmdbData.poster_path, "w342") : null;
  const title = tmdbData?.title || tmdbData?.name || item.movie_id;
  const year = (tmdbData?.release_date || tmdbData?.first_air_date || "").slice(0, 4);

  return (
    <div className="history-card" onClick={onClick}>
      <div className="history-card__poster">
        {poster
          ? <img src={poster} alt={title} loading="lazy" />
          : <div className="history-card__poster-placeholder" />
        }
        {progress !== null && (
          <div className="history-card__progress-bar">
            <div className="history-card__progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="history-card__info">
        <div className="history-card__title">{title}</div>
        <div className="history-card__meta">
          {year && <span>{year}</span>}
          {item.season && <span>S{item.season} E{item.episode}</span>}
          {item.position_seconds > 0 && <span>{formatTime(item.position_seconds)}</span>}
        </div>
        <div className="history-card__time">{timeAgo(item.updated_at)}</div>
      </div>
    </div>
  );
}

const BANNER_KEY = "nestify_migration_banner_dismissed";

export default function HistoryPage() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("current_user"));
  const [items, setItems] = useState([]);
  const [tmdbMap, setTmdbMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [legacySeconds, setLegacySeconds] = useState(0);
  const [legacyCount, setLegacyCount] = useState(0);
  const [showBanner, setShowBanner] = useState(
    !localStorage.getItem(BANNER_KEY)
  );

  const dismissBanner = () => {
    localStorage.setItem(BANNER_KEY, "1");
    setShowBanner(false);
  };

  useEffect(() => {
    if (!currentUser?.id) return;

    (async () => {
      try {
        // Load both in parallel
        const [history, legacy] = await Promise.allSettled([
          getWatchHistory(currentUser.id, 100),
          getLegacyHistory(currentUser.id, false),
        ]);

        // Legacy stats (time only, no cards)
        if (legacy.status === "fulfilled" && Array.isArray(legacy.value)) {
          const legacyItems = legacy.value;
          setLegacyCount(legacyItems.length);
          setLegacySeconds(
            legacyItems.reduce((s, m) => s + (m.position || m.position_seconds || 0), 0)
          );
        }

        // New TMDB history
        if (history.status !== "fulfilled") return;
        const seen = new Set();
        const tmdbItems = history.value.filter(item => {
          if (!parseTmdbId(item.movie_id)) return false;
          if (seen.has(item.movie_id)) return false;
          seen.add(item.movie_id);
          return true;
        });
        setItems(tmdbItems);

        // Fetch TMDB details in parallel
        const results = await Promise.allSettled(
          tmdbItems.map(async (item) => {
            const { mediaType, tmdbId } = parseTmdbId(item.movie_id);
            const res = await axios.get(
              `${config.tmdb_base}/${mediaType}/${tmdbId}`,
              { params: { api_key: config.tmdb_key, language: "uk-UA" } }
            );
            return { movie_id: item.movie_id, data: res.data };
          })
        );
        const map = {};
        results.forEach(r => {
          if (r.status === "fulfilled") map[r.value.movie_id] = r.value.data;
        });
        setTmdbMap(map);
      } catch (e) {
        console.error("History load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser?.id]);

  const handleClick = (item) => {
    const parsed = parseTmdbId(item.movie_id);
    if (!parsed) return;
    navigate(`/title/${parsed.mediaType}/${parsed.tmdbId}`);
  };

  return (
    <div className="container">
      <Header currentUser={currentUser} categories={[]} onMovieSelect={() => {}} />
      <div className="page-content">
        <div className="history-page__content">
          <div className="history-page__inner">
            <h1 className="history-page__heading">Історія перегляду</h1>

            <WatchStats newItems={items} legacySeconds={legacySeconds} />

            {showBanner && (
              <MigrationBanner
                legacyCount={legacyCount}
                legacySeconds={legacySeconds}
                onDismiss={dismissBanner}
              />
            )}

            {loading && (
              <div className="history-page__loading">
                <div className="spinner" />
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="history-page__empty">
                Нові перегляди ще не додані — переглянь щось через нову платформу
              </div>
            )}

            {!loading && items.length > 0 && (
              <div className="history-grid">
                {items.map((item) => (
                  <HistoryCard
                    key={item.movie_id}
                    item={item}
                    tmdbData={tmdbMap[item.movie_id]}
                    onClick={() => handleClick(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
