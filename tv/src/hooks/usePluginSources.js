import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findPluginSources, resolvePluginSource } from "../api/plugins";

const errorText = (e) => e?.response?.data?.detail || "Сервер не відповідає";

export default function usePluginSources({
  title, titleOriginal, year, imdbId, tmdbId, mediaType, seasons, initialSeason, initialEpisode,
}) {
  const isTv = mediaType === "tv";
  const seasonList = useMemo(
    () => (seasons || []).filter((s) => s.season_number > 0 && s.episode_count > 0),
    [seasons]
  );

  const [season, setSeasonState] = useState(() => Number(initialSeason) || seasonList[0]?.season_number || null);
  const [episode, setEpisode] = useState(() => Number(initialEpisode) || 1);
  const [sources, setSources] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveError, setResolveError] = useState(null);
  // Серія може бути відсутня, тому вкладка лишається, якщо плагіни вже щось знаходили.
  const [available, setAvailable] = useState(false);
  const requestRef = useRef(0);

  const episodeCount = seasonList.find((s) => s.season_number === season)?.episode_count || 0;
  const episodes = useMemo(() => Array.from({ length: episodeCount }, (_, i) => i + 1), [episodeCount]);

  const setSeason = useCallback((value) => {
    setSeasonState(value);
    setEpisode(1);
  }, []);

  useEffect(() => {
    if (!title && !titleOriginal) return;
    if (isTv && (!season || !episode)) return;
    const request = ++requestRef.current;
    setLoading(true);
    setResolveError(null);
    findPluginSources({
      kinds: ["direct", "hls"],
      media_type: isTv ? "tv" : "movie",
      title: title || titleOriginal,
      original_title: titleOriginal || undefined,
      year: parseInt(year, 10) || undefined,
      tmdb_id: tmdbId ? String(tmdbId) : undefined,
      imdb_id: imdbId || undefined,
      season: isTv ? season : undefined,
      episode: isTv ? episode : undefined,
    })
      .then((data) => {
        if (request !== requestRef.current) return;
        setSources(data.sources || []);
        setErrors(data.errors || []);
        if (data.sources?.length || data.errors?.length) setAvailable(true);
      })
      .catch((e) => {
        if (request !== requestRef.current) return;
        setSources([]);
        // Старий бекенд або немає доступу: просто не показуємо вкладку.
        console.warn("[plugins] sources failed:", errorText(e));
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [title, titleOriginal, year, tmdbId, imdbId, isTv, season, episode]);

  const resolve = useCallback(async (source) => {
    setResolveError(null);
    setResolvingId(source.id);
    try {
      return await resolvePluginSource(source.plugin_id, source.id);
    } catch (e) {
      setResolveError(errorText(e));
      return null;
    } finally {
      setResolvingId(null);
    }
  }, []);

  return {
    isTv, available, loading, sources, errors, seasonList, episodes,
    season, episode, setSeason, setEpisode, resolve, resolvingId, resolveError,
  };
}
